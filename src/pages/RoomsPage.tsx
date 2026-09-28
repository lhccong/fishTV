import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiPlus, HiUserGroup, HiArrowRight, HiUserCircle, HiLockClosed } from 'react-icons/hi';
import Layout from '../components/Layout';
import CreateRoomDialog from '../components/CreateRoomDialog';
import JoinRoomDialog from '../components/JoinRoomDialog';
import { useCurrentUser } from '../context/AccessGate';
import { useRoomSocket, type RoomSummary } from '../hooks/useRoomSocket';
import '../rooms.css';

export default function RoomsPage() {
  const connection = useRoomSocket();
  const user = useCurrentUser();
  const { connected, listRooms, joinRoom, cancelJoin, room } = connection;
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const result = await listRooms();
      if (result.success) { setRooms(result.rooms || []); setError(''); }
      else setError(result.error || '房间列表加载失败');
    } catch { setError('房间列表加载失败，请重试'); }
    finally { setLoading(false); }
  }, [listRooms]);
  useEffect(() => {
    if (!connected) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [connected, refresh]);
  const enter = async (id: string) => {
    const result = await joinRoom(id);
    if (!result.success && ['ROOM_PASSWORD_REQUIRED', 'ROOM_PASSWORD_INVALID'].includes(result.code || '')) {
      setError(''); setJoining(id); return;
    }
    if (!result.success) { setError(result.error || '加入失败'); return; }
    navigate(`/rooms/${encodeURIComponent(id)}`);
  };
  return <Layout>
    <div className="rooms-lobby">
    <section className="rooms-intro" aria-labelledby="rooms-heading">
      <span className="rooms-eyebrow"><HiUserGroup />今晚，好戏开场</span>
      <div className="rooms-headline">
        <p>和喜欢的人</p>
        <h1 id="rooms-heading">一起看电影</h1>
      </div>
      <p className="rooms-subtitle">把距离留在银幕之外<strong>把这一幕，留在我们的回忆里</strong></p>
      <div className="rooms-console">
        <div className="rooms-identity">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <HiUserCircle />}
          <span>{user?.username || '观影用户'}</span>
        </div>
        <button type="button" disabled={!connected || busy} className="rooms-create" onClick={() => setCreating(true)}><HiPlus />创建房间</button>
        {room && <Link className="rooms-return" to={`/rooms/${room.id}`}>返回房间<HiArrowRight /></Link>}
      </div>
      {room && <p className="rooms-current">当前房间 <strong>{room.name}</strong></p>}
    </section>
    {(error || connection.error) && <p role="alert" className="my-4 text-red-600">{error || connection.error}</p>}
    <section className="rooms-list">
      <div className="rooms-list-heading"><h2>发现放映室</h2><span>{rooms.length} 个放映室</span></div>
      {connection.error || error ? <button disabled={!connected} onClick={() => { setLoading(true); void refresh(); }} className="rounded border px-4 py-2 disabled:opacity-50">重新加载</button> : loading ? <p role="status">{connected ? '正在加载房间...' : '正在连接房间服务...'}</p> : rooms.length === 0 ? <p className="py-12 text-center text-gray-500">暂无房间</p> :
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{rooms.map(item => <article key={item.id} className="rooms-card min-w-0 p-5">
          <div className="flex items-start gap-3"><img src="https://oss.cqbo.com/moyu/moyu.png" alt="" className="h-12 w-12 shrink-0 rounded object-contain" />
            <div className="min-w-0"><h2 className="break-all text-lg font-semibold">{item.name}</h2>{item.hasPassword && <span className="inline-flex items-center gap-1 text-xs app-muted"><HiLockClosed />密码房间</span>}<p className="text-sm text-gray-500">房间号 {item.id}</p></div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2"><span className="flex items-center gap-1 text-sm text-gray-500"><HiUserGroup />{item.memberCount} 人 · {item.playback ? '正在观影' : '等待选片'}</span>
            <button disabled={!connected || busy} onClick={async () => { setBusy(true); try { await enter(item.id); } finally { setBusy(false); } }} className="rooms-enter">{room?.id === item.id ? '进入房间' : '加入房间'}<HiArrowRight /></button>
          </div>
        </article>)}</div>}
    </section>
    </div>
    {creating && <CreateRoomDialog onClose={() => setCreating(false)} onCreated={async created => {
      const result = await joinRoom(created.id);
      if (!result.success) throw new Error(result.error || '加入失败，请重试');
      navigate(`/rooms/${encodeURIComponent(created.id)}`);
    }} />}
    {joining && <JoinRoomDialog key={joining} roomId={joining} roomName={rooms.find(item => item.id === joining)?.name}
      onClose={() => { cancelJoin(joining); setJoining(null); }}
      onJoined={() => navigate(`/rooms/${encodeURIComponent(joining)}`)} />}
  </Layout>;
}
