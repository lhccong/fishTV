import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HiHeart, HiPlay, HiX } from 'react-icons/hi';
import { VIDEO_SOURCES } from '../api/config';
import { allEpisodes, isRoomMedia } from '../lib/roomVideo';
import type { Video } from '../api/types';

type Props = {
  video: Video;
  source: string;
  episode: number;
  busy: boolean;
  connected: boolean;
  notice?: string;
  onEpisodeChange: (episode: number) => void;
  onSourceChange: (source: string) => void;
  onPublish: () => void;
  onClose: () => void;
};

export default function RoomVideoDetailModal({
  video,
  source,
  episode,
  busy,
  connected,
  notice,
  onEpisodeChange,
  onSourceChange,
  onPublish,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const episodes = allEpisodes(video);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="room-video-detail-dialog"
      aria-labelledby={headingId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="room-video-detail-modal">
        {notice && <p className="room-video-detail-toast" role="alert">{notice}</p>}
        <header className="room-video-detail-heading">
          <h2 id={headingId}>影片详情</h2>
          <button type="button" aria-label="关闭影片详情" onClick={onClose}><HiX /></button>
        </header>

        <section className="room-video-detail-summary">
          <h1>{video.vod_name}</h1>
          <div className="room-video-detail-main">
            <img src={video.vod_pic} alt={video.vod_name} />
            <div className="room-video-detail-info">
              <p className="room-video-detail-meta">
                <span>{video.vod_year || '未知年份'}</span>
                <span>{video.vod_area || '未知地区'}</span>
                <span>{video.type_name || '影片'}</span>
              </p>
              <div
                className="room-video-detail-description"
                dangerouslySetInnerHTML={{ __html: video.vod_content || '暂无简介' }}
              />
              <div className="room-video-detail-actions">
                <button
                  type="button"
                  className="watch-primary"
                  disabled={busy || !connected || !isRoomMedia(episodes[episode - 1]?.url || '')}
                  onClick={onPublish}
                >
                  <HiPlay />共同播放
                </button>
                <button type="button" className="room-video-detail-favorite" disabled>
                  <HiHeart />收藏
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="room-video-detail-episodes">
          <h3>选集播放</h3>
          <div className="room-video-detail-sources" role="tablist" aria-label="视频源">
            {Object.entries(VIDEO_SOURCES).map(([id, item]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === source}
                className={id === source ? 'is-active' : ''}
                disabled={busy || id === source}
                onClick={() => onSourceChange(id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          {episodes.length ? (
            <div className="room-video-detail-episode-grid">
              {episodes.map((item, index) => {
                const episodeNumber = index + 1;
                const playable = isRoomMedia(item.url);
                return (
                  <button
                    key={`${episodeNumber}:${item.url}`}
                    type="button"
                    className={episodeNumber === episode ? 'is-active' : ''}
                    disabled={!playable || busy}
                    onClick={() => onEpisodeChange(episodeNumber)}
                  >
                    {item.name || `第${episodeNumber.toString().padStart(2, '0')}集`}
                  </button>
                );
              })}
            </div>
          ) : <p className="room-video-detail-empty">该影片暂无可用集数</p>}
        </section>
      </div>
    </dialog>,
    document.body,
  );
}
