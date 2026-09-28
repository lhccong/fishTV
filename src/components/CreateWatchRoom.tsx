import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiUserGroup } from 'react-icons/hi';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { isRoomMedia, roomEpisodes } from '../lib/roomVideo';
import type { Video } from '../api/types';
import CreateRoomDialog from './CreateRoomDialog';

type Props = {
  video: Video;
  source: string;
  episode: number;
  url: string;
  getPosition: () => number;
};

export default function CreateWatchRoom({ video, source, episode, url, getPosition }: Props) {
  const { connected, room, joinRoom, setRoomPlayback } = useRoomSocket();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const supported = isRoomMedia(url) && roomEpisodes(video)[episode - 1]?.url === url;

  const start = () => {
    if (!connected) return;
    if (room &&
      !window.confirm('进入新房间将离开当前房间，原房间的播放不会改变。继续吗？')) return;
    setCreating(true);
  };

  return <div className="play-room-entry">
    <button type="button" onClick={start} disabled={creating || !connected}>
      <HiUserGroup aria-hidden="true" />{supported ? '创建房间一起看' : '创建并进入房间'}
    </button>
    {!supported && <p>当前线路无法同步，将先进入房间，再选择可共同播放的影片。</p>}
    {!connected && <p role="status">正在连接房间服务...</p>}
    {creating && <CreateRoomDialog initialName={`${video.vod_name} · 一起看`.slice(0, 80)} onClose={() => setCreating(false)} onCreated={async created => {
      const position = getPosition();
      const joined = await joinRoom(created.id);
      if (!joined.success) throw new Error(joined.error || '加入房间失败');
      if (supported) {
        const published = await setRoomPlayback({
          videoId: String(video.vod_id), sourceId: source, episode, videoUrl: url,
          title: video.vod_name, cover: video.vod_pic, playing: true,
          positionSeconds: Number.isFinite(position) ? Math.max(0, position) : 0,
        });
        if (!published.success) throw new Error(published.error || '设置共同播放失败');
      }
      navigate(`/rooms/${encodeURIComponent(created.id)}`);
    }} />}
  </div>;
}
