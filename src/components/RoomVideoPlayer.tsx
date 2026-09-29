import { useEffect, useRef, useState } from 'react';
import DPlayer from 'dplayer';
import Hls from 'hls.js';
import { HiPlay } from 'react-icons/hi';
import type { RoomPlayback, RoomChatMessage, RoomSummary, RoomClockResult } from '../hooks/useRoomSocket';
import RoomPlayerChat from './RoomPlayerChat';
import { normalizePlaybackRate } from '../../shared/roomPlayback';

type Props = {
  url: string;
  playback: RoomPlayback;
  owner: boolean;
  connected: boolean;
  clockReporter: boolean;
  getServerNow: () => number | null;
  playMode: NonNullable<RoomSummary['playMode']>;
  onPlayModeChange: (mode: NonNullable<RoomSummary['playMode']>) => Promise<{ success: boolean; error?: string }>;
  canSetPlaybackRate: boolean;
  onPlaybackRateChange: (rate: number, position: number, revision: number) => Promise<{ success: boolean; error?: string }>;
  onClock: (position: number, playing: boolean, revision: number, kind: 'control' | 'heartbeat') => Promise<RoomClockResult>;
  messages: RoomChatMessage[];
  liveMessages: RoomChatMessage[];
  userId?: string;
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
  onEnded?: () => void;
};

export default function RoomVideoPlayer({ url, playback, owner, connected, clockReporter, getServerNow, playMode, onPlayModeChange, canSetPlaybackRate, onPlaybackRateChange, onClock, messages, liveMessages, userId, sendChat, onEnded }: Props) {
  const element = useRef<HTMLVideoElement | null>(null);
  const playerHost = useRef<HTMLDivElement>(null);
  const [controls, setControls] = useState<HTMLElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [pip, setPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipReady, setPipReady] = useState(false);
  const [displayBusy, setDisplayBusy] = useState(false);
  const [displayError, setDisplayError] = useState('');
  const displayPending = useRef(false);
  const fullscreen = nativeFullscreen || theater;
  const receivedPlayback = useRef({ revision: playback.revision, at: performance.now() });
  if (receivedPlayback.current.revision !== playback.revision) {
    receivedPlayback.current = { revision: playback.revision, at: performance.now() };
  }
  const live = useRef({ playback, owner, connected, clockReporter, getServerNow, onClock, onEnded });
  live.current = { playback, owner, connected, clockReporter, getServerNow, onClock, onEnded };
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
  }, [playback.revision, playback.playbackRate, connected, rateBusy, clockReporter]);

  useEffect(() => {
    const changed = () => setNativeFullscreen(document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  useEffect(() => {
    if (!theater) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTheater(false); };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
    };
  }, [theater]);

  const toggleFullscreen = async () => {
    const host = container.current;
    if (!host || displayPending.current) return;
    displayPending.current = true;
    setDisplayBusy(true); setDisplayError('');
    try {
      if (document.fullscreenElement === host) {
        await document.exitFullscreen();
      } else {
        if (element.current && document.pictureInPictureElement === element.current) await document.exitPictureInPicture();
        if (!host.isConnected) return;
        if (!document.fullscreenEnabled || !host.requestFullscreen) { setTheater(value => !value); return; }
        await host.requestFullscreen();
        if (host.isConnected) setTheater(false);
      }
    } catch {
      if (host.isConnected) setDisplayError('全屏切换失败，请重试或使用网页全屏');
    } finally {
      displayPending.current = false;
      if (host.isConnected) setDisplayBusy(false);
    }
  };

  const toggleTheater = async () => {
    const host = container.current;
    if (!host || displayPending.current) return;
    displayPending.current = true;
    setDisplayBusy(true); setDisplayError('');
    try {
      if (document.fullscreenElement === host) await document.exitFullscreen();
      if (element.current && document.pictureInPictureElement === element.current) await document.exitPictureInPicture();
      if (host.isConnected) setTheater(value => !value);
    } catch {
      if (host.isConnected) setDisplayError('网页全屏切换失败，请重试');
    } finally {
      displayPending.current = false;
      if (host.isConnected) setDisplayBusy(false);
    }
  };

  const togglePip = async () => {
    const video = element.current;
    if (!video || displayPending.current || !pipSupported) return;
    if (document.pictureInPictureElement !== video && !pipReady) return;
    displayPending.current = true;
    setDisplayBusy(true); setDisplayError('');
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        // Request directly from the click to retain the browser's user activation.
        await video.requestPictureInPicture();
        if (element.current !== video) {
          if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
          return;
        }
        setTheater(false);
        if (document.fullscreenElement === container.current) await document.exitFullscreen();
      }
    } catch {
      if (element.current === video) setDisplayError('画中画切换失败，请重试');
    } finally {
      displayPending.current = false;
      if (element.current) setDisplayBusy(false);
    }
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
    setPip(false); setPipReady(false); setDisplayError('');
    setPipSupported(Boolean(document.pictureInPictureEnabled && video.requestPictureInPicture));
    const updatePipReady = () => setPipReady(video.readyState >= 2 && video.videoWidth > 0 && !video.disablePictureInPicture);
    const enteredPip = () => setPip(true);
    const leftPip = () => setPip(false);
    video.addEventListener('loadeddata', updatePipReady);
    video.addEventListener('emptied', updatePipReady);
    video.addEventListener('enterpictureinpicture', enteredPip);
    video.addEventListener('leavepictureinpicture', leftPip);
    const tools = document.createElement('div');
    host.querySelector('.dplayer-icons-right')!.appendChild(tools);
    setControls(tools);
    let hls: Hls | undefined;
    let disposed = false;
    let syncSeeking = false;
    let syncPlayEvent: 'play' | 'pause' | null = null;
    let nextSeekAt = 0;
    let sending = false;
    let queuedControl = false;
    let reportedRevision = -1;
    let correctClockDrift = false;
    let attempting = false;
    let appliedRevision = -1;
    let endedReported = false;
    setError(''); setBlocked(false);
    const finish = () => {
      if (endedReported || !live.current.owner || !live.current.clockReporter) return;
      endedReported = true;
      live.current.onEnded?.();
    };
    const sync = () => {
      const state = live.current.playback;
      if (!live.current.connected) { appliedRevision = -1; return; }
      if (disposed || video.readyState < 1 || sending || queuedControl || ratePending.current) return;
      const rate = normalizePlaybackRate(state.playbackRate);
      if (video.playbackRate !== rate) video.playbackRate = rate;
      if (video.ended) {
        finish();
        return;
      }
      // Before calibration (including an older server), use receipt age rather than a device wall clock.
      const age = live.current.getServerNow();
      const elapsed = age === null ? performance.now() - receivedPlayback.current.at : age - state.updatedAt;
      const target = Math.max(0, state.positionSeconds + (state.playing ? Math.max(0, elapsed) / 1000 * rate : 0));
      const position = Number.isFinite(video.duration) ? Math.min(target, Math.max(0, video.duration - 0.05)) : target;
      const changed = appliedRevision !== state.revision;
      const initial = appliedRevision < 0;
      const seekReady = !syncSeeking && !video.seeking && (initial ||
        (video.readyState >= (state.playing ? 3 : 2) && performance.now() >= nextSeekAt));
      if (seekReady) {
        appliedRevision = state.revision;
        // An acknowledged local clock is not a remote seek command.
        if ((initial || correctClockDrift || (changed && state.revision !== reportedRevision) || !live.current.clockReporter) &&
          Math.abs(video.currentTime - position) > 1.5) {
          syncSeeking = true;
          video.currentTime = position;
        }
        correctClockDrift = false;
      }
      if (state.playing && video.paused && !video.ended && !attempting) {
        syncPlayEvent = 'play';
        attempting = true;
        void video.play().then(() => { if (!disposed) setBlocked(false); })
          .catch(() => { syncPlayEvent = null; if (!disposed) setBlocked(true); })
          .finally(() => { attempting = false; });
      } else if (!state.playing && !video.paused) {
        syncPlayEvent = 'pause';
        video.pause();
      }
    };
    const report = (event?: Event, kind: 'control' | 'heartbeat' = 'control') => {
      if (event?.type === 'seeked' && syncSeeking) {
        syncSeeking = false;
        // Let media refill before considering another drift correction.
        nextSeekAt = performance.now() + 3000;
        return;
      }
      if (event?.type === syncPlayEvent) { syncPlayEvent = null; return; }
      if (disposed || !live.current.connected || ratePending.current) return;
      if (!live.current.owner) {
        sync();
        return;
      }
      if (kind === 'heartbeat' && (!live.current.clockReporter || video.readyState < 3 ||
        video.paused || video.ended || syncSeeking || !live.current.playback.playing)) return;
      if (video.readyState < 1 || video.seeking || video.ended) return;
      if (sending) { if (kind === 'control') queuedControl = true; return; }
      sending = true;
      void live.current.onClock(video.currentTime, !video.paused && !video.ended,
        Math.max(live.current.playback.revision, reportedRevision), kind)
        .then(result => {
          if (result.success && result.playback) reportedRevision = result.playback.revision;
          if (result.code === 'CLOCK_DRIFT') correctClockDrift = true;
        })
        .catch(() => { if (!disposed) setDisplayError('播放同步失败，请重试'); })
        .finally(() => {
          sending = false;
          if (queuedControl && !disposed) { queuedControl = false; report(); }
        });
    };
    const failure = () => setError('视频加载失败，请重试或由房主切换视频源');
    const restoreRate = () => {
      const rate = normalizePlaybackRate(live.current.playback.playbackRate);
      if (video.playbackRate !== rate) video.playbackRate = rate;
    };
    const handlePlaybackKey = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', ' '].includes(event.key) ||
        disposed || event.defaultPrevented || event.isComposing ||
        event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        !live.current.owner || !live.current.connected || ratePending.current || video.readyState < 1 ||
        document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable ||
        target.closest('input, textarea, select, button, a, [role="button"], [role="slider"], [role="menu"], [role="textbox"], [contenteditable]:not([contenteditable="false"])'))) return;
      if (event.key !== ' ' && (!Number.isFinite(video.duration) || video.duration <= 0)) return;
      event.preventDefault();
      if (event.key === ' ' && event.repeat) return;
      // Explicit input must not be suppressed as an echo of room synchronization.
      syncSeeking = false;
      syncPlayEvent = null;
      if (event.key === ' ') {
        if (video.paused) {
          void video.play().then(() => { if (!disposed) setBlocked(false); })
            .catch(() => { if (!disposed) setBlocked(true); });
        } else video.pause();
      } else {
        player.seek(Math.max(0, Math.min(video.duration, video.currentTime + (event.key === 'ArrowRight' ? 5 : -5))));
      }
    };
    document.addEventListener('keydown', handlePlaybackKey);
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
    const heartbeat = window.setInterval(() => report(undefined, 'heartbeat'), 10000);
    return () => {
      disposed = true;
      syncPlayback.current = null;
      clearInterval(timer); clearInterval(heartbeat);
      document.removeEventListener('keydown', handlePlaybackKey);
      video.removeEventListener('loadedmetadata', sync);
      for (const event of ['play', 'pause', 'seeked']) video.removeEventListener(event, report);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', failure);
      video.removeEventListener('ratechange', restoreRate);
      video.removeEventListener('loadeddata', updatePipReady);
      video.removeEventListener('emptied', updatePipReady);
      video.removeEventListener('enterpictureinpicture', enteredPip);
      video.removeEventListener('leavepictureinpicture', leftPip);
      if (document.pictureInPictureElement === video) {
        // Removing the media below also terminates PiP if the explicit exit races with the browser.
        void document.exitPictureInPicture().catch(() => {});
      }
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
      nativeFullscreen={nativeFullscreen} theater={theater} onTheater={() => void toggleTheater()}
      pip={pip} pipSupported={pipSupported} pipReady={pipReady} displayBusy={displayBusy} onPip={() => void togglePip()}
      playMode={playMode} canSetPlayMode={owner} playModeBusy={playModeBusy}
      onPlayModeChange={mode => void changePlayMode(mode)}
      playbackRate={normalizePlaybackRate(playback.playbackRate)} canSetPlaybackRate={canSetPlaybackRate}
      rateBusy={rateBusy} onPlaybackRateChange={rate => void changePlaybackRate(rate)}
      messages={messages} liveMessages={liveMessages} userId={userId} sendChat={sendChat} />
    {(displayError || rateError || playModeError) && <p className="watch-rate-error" role="alert">{displayError || rateError || playModeError}</p>}
    {blocked && !error && <button className="watch-unlock" onClick={() => {
      void element.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }}><HiPlay />点击开始观看</button>}
    {error && <div className="watch-player-error" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>重试加载</button></div>}
  </div>;
}
