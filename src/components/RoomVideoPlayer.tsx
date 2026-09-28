import { useEffect, useRef, useState } from 'react';
import DPlayer from 'dplayer';
import Hls from 'hls.js';
import { HiPlay } from 'react-icons/hi';
import type { RoomPlayback, RoomChatMessage, RoomSummary } from '../hooks/useRoomSocket';
import RoomPlayerChat from './RoomPlayerChat';
import { normalizePlaybackRate } from '../../shared/roomPlayback';

type Props = {
  url: string;
  playback: RoomPlayback;
  owner: boolean;
  connected: boolean;
  playMode: NonNullable<RoomSummary['playMode']>;
  onPlayModeChange: (mode: NonNullable<RoomSummary['playMode']>) => Promise<{ success: boolean; error?: string }>;
  canSetPlaybackRate: boolean;
  onPlaybackRateChange: (rate: number, position: number, revision: number) => Promise<{ success: boolean; error?: string }>;
  onClock: (position: number, playing: boolean, revision: number) => Promise<void>;
  messages: RoomChatMessage[];
  liveMessages: RoomChatMessage[];
  userId?: string;
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
  onEnded?: () => void;
};

export default function RoomVideoPlayer({ url, playback, owner, connected, playMode, onPlayModeChange, canSetPlaybackRate, onPlaybackRateChange, onClock, messages, liveMessages, userId, sendChat, onEnded }: Props) {
  const element = useRef<HTMLVideoElement | null>(null);
  const playerHost = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const fullscreen = nativeFullscreen || theater;
  const live = useRef({ playback, owner, connected, onClock, onEnded });
  live.current = { playback, owner, connected, onClock, onEnded };
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [retry, setRetry] = useState(0);
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState('');
  const ratePending = useRef(false);
  const syncPlayback = useRef<(() => void) | null>(null);
  const [playModeBusy, setPlayModeBusy] = useState(false);
  const [playModeError, setPlayModeError] = useState('');
  const playModePending = useRef(false);

  const changePlayMode = async (mode: NonNullable<RoomSummary['playMode']>) => {
    if (!owner || !connected || playModePending.current || mode === playMode) return;
    playModePending.current = true;
    setPlayModeBusy(true); setPlayModeError(''); setRateError('');
    try {
      const result = await onPlayModeChange(mode);
      if (!result.success) setPlayModeError(result.error || '播放设置保存失败，请重试');
    } catch { setPlayModeError('播放设置保存失败，请重试'); }
    finally { playModePending.current = false; setPlayModeBusy(false); }
  };

  const changePlaybackRate = async (rate: number) => {
    const video = element.current;
    if (!canSetPlaybackRate || !connected || ratePending.current || !video || video.readyState < 1) return;
    ratePending.current = true;
    setRateBusy(true); setRateError(''); setPlayModeError('');
    try {
      const result = await onPlaybackRateChange(rate, video.currentTime, live.current.playback.revision);
      if (!result.success) setRateError(result.error || '倍速调整失败，请重试');
    } catch { setRateError('倍速调整失败，请重试'); }
    finally { ratePending.current = false; setRateBusy(false); }
  };

  useEffect(() => {
    syncPlayback.current?.();
  }, [playback.revision, playback.playbackRate, connected, rateBusy]);

  useEffect(() => {
    const changed = () => setNativeFullscreen(document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  useEffect(() => {
    if (!theater) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTheater(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [theater]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === container.current) {
      try { await document.exitFullscreen(); } catch { /* Keep the exit control available. */ }
      return;
    }
    if (theater) { setTheater(false); return; }
    // Page-wide mode preserves the chat overlay where element fullscreen is unavailable.
    if (!document.fullscreenEnabled || !container.current?.requestFullscreen) { setTheater(true); return; }
    try { await container.current.requestFullscreen(); }
    catch { setTheater(true); }
  };

  useEffect(() => {
    const host = playerHost.current!;
    const player = new DPlayer({
      container: host,
      lang: 'zh-cn',
      autoplay: false,
      theme: '#ec4c62',
      hotkey: false,
      mutex: false,
      preload: 'auto',
      playbackSpeed: [1],
      // Attach the source below, after room synchronization listeners are ready.
      video: { url: '', type: 'normal' },
    });
    const video = player.video;
    element.current = video;
    video.setAttribute('aria-label', '共同播放视频');
    video.playsInline = true;
    const tools = document.createElement('div');
    host.querySelector('.dplayer-icons-right')!.appendChild(tools);
    setControls(tools);
    let hls: Hls | undefined;
    let disposed = false;
    let applyingUntil = 0;
    let sending = false;
    let attempting = false;
    let appliedRevision = -1;
    let endedReported = false;
    setError(''); setBlocked(false);
    const finish = () => {
      if (endedReported || !live.current.owner) return;
      endedReported = true;
      live.current.onEnded?.();
    };
    const sync = () => {
      const state = live.current.playback;
      if (disposed || !live.current.connected || video.readyState < 1 || sending || ratePending.current) return;
      const rate = normalizePlaybackRate(state.playbackRate);
      if (video.playbackRate !== rate) video.playbackRate = rate;
      if (video.ended) {
        finish();
        return;
      }
      const target = Math.max(0, state.positionSeconds + (state.playing ? Math.max(0, Date.now() - state.updatedAt) / 1000 * rate : 0));
      const position = Number.isFinite(video.duration) ? Math.min(target, Math.max(0, video.duration - 0.05)) : target;
      const changed = appliedRevision !== state.revision;
      appliedRevision = state.revision;
      // The owner reports the actual media clock; only followers correct drift periodically.
      if ((changed || !live.current.owner) && Math.abs(video.currentTime - position) > 1.5) {
        applyingUntil = performance.now() + 500;
        video.currentTime = position;
      }
      if (state.playing && video.paused && !video.ended && !attempting) {
        applyingUntil = performance.now() + 500;
        attempting = true;
        void video.play().then(() => { if (!disposed) setBlocked(false); })
          .catch(() => { if (!disposed) setBlocked(true); })
          .finally(() => { attempting = false; });
      } else if (!state.playing && !video.paused) {
        applyingUntil = performance.now() + 500;
        video.pause();
      }
    };
    const report = () => {
      if (disposed || performance.now() < applyingUntil || !live.current.connected || ratePending.current) return;
      if (!live.current.owner) {
        // Non-owner: immediately correct any state mismatch
        const state = live.current.playback;
        if (state.playing && video.paused && !video.ended) {
          void video.play().catch(() => {});
        } else if (!state.playing && !video.paused) {
          video.pause();
        }
        return;
      }
      if (sending || video.readyState < 1) return;
      sending = true;
      void live.current.onClock(video.currentTime, !video.paused && !video.ended, live.current.playback.revision)
        .finally(() => { sending = false; });
    };
    const failure = () => setError('视频加载失败，请重试或由房主切换视频源');
    const restoreRate = () => {
      const rate = normalizePlaybackRate(live.current.playback.playbackRate);
      if (video.playbackRate !== rate) video.playbackRate = rate;
    };
    syncPlayback.current = sync;
    video.addEventListener('ratechange', restoreRate);
    video.addEventListener('loadedmetadata', sync);
    for (const event of ['play', 'pause', 'seeked']) video.addEventListener(event, report);
    const ended = () => finish();
    video.addEventListener('ended', ended);
    video.addEventListener('error', failure);
    if (/\.m3u8(?:$|\?)/i.test(url) && Hls.isSupported()) {
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) failure(); });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else { video.src = url; }
    const timer = window.setInterval(sync, 1000);
    const heartbeat = window.setInterval(report, 10000);
    return () => {
      disposed = true;
      syncPlayback.current = null;
      clearInterval(timer); clearInterval(heartbeat);
      video.removeEventListener('loadedmetadata', sync);
      for (const event of ['play', 'pause', 'seeked']) video.removeEventListener(event, report);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', failure);
      video.removeEventListener('ratechange', restoreRate);
      hls?.destroy();
      setControls(null);
      element.current = null;
      player.destroy();
      video.removeAttribute('src'); video.load();
    };
  }, [url, retry]);

  return <div ref={container} className={`watch-video ${theater ? 'watch-video-theater' : ''}`}>
    <div ref={playerHost} className="watch-dplayer"
      onDoubleClick={event => {
        if (event.target instanceof HTMLElement && event.target.closest('.dplayer-video-wrap')) {
          event.preventDefault(); void toggleFullscreen();
        }
      }} />
    <RoomPlayerChat controls={controls} fullscreen={fullscreen} onFullscreen={() => void toggleFullscreen()} connected={connected}
      playMode={playMode} canSetPlayMode={owner} playModeBusy={playModeBusy}
      onPlayModeChange={mode => void changePlayMode(mode)}
      playbackRate={normalizePlaybackRate(playback.playbackRate)} canSetPlaybackRate={canSetPlaybackRate}
      rateBusy={rateBusy} onPlaybackRateChange={rate => void changePlaybackRate(rate)}
      messages={messages} liveMessages={liveMessages} userId={userId} sendChat={sendChat} />
    {(rateError || playModeError) && <p className="watch-rate-error" role="alert">{rateError || playModeError}</p>}
    {blocked && !error && <button className="watch-unlock" onClick={() => {
      void element.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }}><HiPlay />点击开始观看</button>}
    {error && <div className="watch-player-error" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>重试加载</button></div>}
  </div>;
}
