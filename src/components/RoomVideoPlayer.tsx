import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { HiPlay } from 'react-icons/hi';
import type { RoomPlayback, RoomChatMessage } from '../hooks/useRoomSocket';
import RoomPlayerChat from './RoomPlayerChat';

type Props = {
  url: string;
  playback: RoomPlayback;
  owner: boolean;
  connected: boolean;
  onClock: (position: number, playing: boolean, revision: number) => Promise<void>;
  messages: RoomChatMessage[];
  liveMessages: RoomChatMessage[];
  userId?: string;
  sendChat: (text: string) => Promise<{ success: boolean; error?: string }>;
};

export default function RoomVideoPlayer({ url, playback, owner, connected, onClock, messages, liveMessages, userId, sendChat }: Props) {
  const element = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const fullscreen = nativeFullscreen || theater;
  const live = useRef({ playback, owner, connected, onClock });
  live.current = { playback, owner, connected, onClock };
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [retry, setRetry] = useState(0);

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
    const video = element.current!;
    let hls: Hls | undefined;
    let disposed = false;
    let applyingUntil = 0;
    let sending = false;
    let attempting = false;
    let appliedRevision = -1;
    setError(''); setBlocked(false);
    const sync = () => {
      const state = live.current.playback;
      if (disposed || !live.current.connected || video.readyState < 1 || sending) return;
      const target = Math.max(0, state.positionSeconds + (state.playing ? Math.max(0, Date.now() - state.updatedAt) / 1000 : 0));
      const position = Number.isFinite(video.duration) ? Math.min(target, Math.max(0, video.duration - 0.05)) : target;
      const changed = appliedRevision !== state.revision;
      appliedRevision = state.revision;
      // The owner reports the actual media clock; only followers correct drift periodically.
      if ((changed || !live.current.owner) && Math.abs(video.currentTime - position) > 1.5) {
        applyingUntil = performance.now() + 500;
        video.currentTime = position;
      }
      if (state.playing && video.paused && !attempting) {
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
      if (disposed || performance.now() < applyingUntil || !live.current.connected) return;
      if (!live.current.owner) { sync(); return; }
      if (sending || video.readyState < 1) return;
      sending = true;
      void live.current.onClock(video.currentTime, !video.paused && !video.ended, live.current.playback.revision)
        .finally(() => { sending = false; });
    };
    const failure = () => setError('视频加载失败，请重试或由房主切换视频源');
    video.addEventListener('loadedmetadata', sync);
    for (const event of ['play', 'pause', 'seeked', 'ended']) video.addEventListener(event, report);
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
      clearInterval(timer); clearInterval(heartbeat);
      video.removeEventListener('loadedmetadata', sync);
      for (const event of ['play', 'pause', 'seeked', 'ended']) video.removeEventListener(event, report);
      video.removeEventListener('error', failure);
      hls?.destroy();
      video.pause(); video.removeAttribute('src'); video.load();
    };
  }, [url, retry]);

  return <div ref={container} className={`watch-video ${theater ? 'watch-video-theater' : ''}`}>
    <video ref={element} controls controlsList="nofullscreen" playsInline preload="auto" aria-label="共同播放视频"
      onDoubleClick={event => { event.preventDefault(); void toggleFullscreen(); }} />
    <RoomPlayerChat fullscreen={fullscreen} onFullscreen={() => void toggleFullscreen()} connected={connected}
      messages={messages} liveMessages={liveMessages} userId={userId} sendChat={sendChat} />
    {blocked && !error && <button className="watch-unlock" onClick={() => {
      void element.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    }}><HiPlay />点击开始观看</button>}
    {error && <div className="watch-player-error" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>重试加载</button></div>}
  </div>;
}
