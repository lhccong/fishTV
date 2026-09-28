import { useEffect, useRef, useState } from 'react';
import { HiRefresh, HiSave, HiUserGroup, HiLockClosed, HiTrash } from 'react-icons/hi';
import { accountRequest, jsonBody } from '../api/account';
import type { RoomSummary } from '../hooks/useRoomSocket';

type ManagedRoom = RoomSummary & { emptyMinutes: number | null; emptySince: number | null; expiresAt: number | null };
type RoomOverview = { rooms: ManagedRoom[]; policy: { emptyMinutes: number } };
type Props = { onError: (error: unknown) => void };

export default function AdminRooms({ onError }: Props) {
  const [data, setData] = useState<RoomOverview | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [permanent, setPermanent] = useState(false);
  const [inherit, setInherit] = useState(true);
  const [roomMinutes, setRoomMinutes] = useState(30);
  const [passwordAction, setPasswordAction] = useState('keep');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const current = data?.rooms.find(room => room.id === selected);

  const load = async () => {
    const result = await accountRequest<RoomOverview>('/api/admin/rooms');
    setData(result);
    setMinutes(result.policy.emptyMinutes);
    return result;
  };
  useEffect(() => {
    let cancelled = false;
    void accountRequest<RoomOverview>('/api/admin/rooms').then(result => {
      if (!cancelled) { setData(result); setMinutes(result.policy.emptyMinutes); }
    }).catch(error => { if (!cancelled) { setMessage('房间列表加载失败'); onError(error); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const run = async (operation: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try { await operation(); }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败'); onError(error); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const edit = (room: ManagedRoom) => {
    setSelected(room.id); setPermanent(Boolean(room.permanent));
    setInherit(room.emptyMinutes === null); setRoomMinutes(room.emptyMinutes || 30);
    setPasswordAction('keep'); setPassword(''); setMessage('');
  };
  const remove = (room: ManagedRoom) => {
    if (inFlight.current || !window.confirm(`确定移除“${room.name}”（${room.id}）吗？房间、聊天和播放记录将被删除，在线成员将退出，且无法恢复。`)) return;
    void run(async () => {
      await accountRequest(`/api/admin/rooms/${encodeURIComponent(room.id)}`, { method: 'DELETE' });
      setData(current => current && { ...current, rooms: current.rooms.filter(item => item.id !== room.id) });
      if (selected === room.id) { setSelected(null); setPassword(''); }
      setMessage('房间已移除，房主可重新创建房间');
    });
  };

  return <section className="account-section account-rooms">
    <div className="account-rooms-heading">
      <h2><HiUserGroup />房间管理</h2>
      <button type="button" className="account-secondary" disabled={busy} onClick={() => void run(async () => { await load(); })}><HiRefresh />刷新</button>
    </div>
    <form onSubmit={event => {
      event.preventDefault();
      if (minutes > 0 && !window.confirm('开启或缩短清理时限后，已超时的空房间可能被删除且无法恢复。确定保存吗？')) return;
      void run(async () => {
        await accountRequest('/api/admin/room-policy', jsonBody({ emptyMinutes: minutes }, 'PUT'));
        await load(); setMessage('全局清理配置已保存');
      });
    }}>
      <fieldset disabled={busy || !data}>
        <label>全局空房清理时间（分钟，0 为不自动清理）
          <input required type="number" min={0} max={43200} step={1} value={minutes} onChange={event => setMinutes(Number(event.target.value))} />
        </label>
        <div className="account-actions"><button type="submit"><HiSave />保存全局配置</button></div>
      </fieldset>
    </form>
    {message && <p className="account-help" role="status">{message}</p>}
    {!data ? <p role="status">{loading || busy ? '正在加载房间...' : '未能加载房间，请刷新重试'}</p> : <>
      <div className="account-rooms-table">
        <table>
          <caption>房间列表（{data.rooms.length}）</caption>
          <thead><tr><th>房间</th><th>在线</th><th>保留策略</th><th>访问</th><th>操作</th></tr></thead>
          <tbody>{data.rooms.map(room => <tr key={room.id}>
            <td><strong>{room.name}</strong><small>{room.id}</small></td>
            <td>{room.memberCount} 人</td>
            <td>{room.permanent ? '永驻' : room.emptyMinutes !== null ? `空房 ${room.emptyMinutes} 分钟` : data.policy.emptyMinutes ? `跟随全局 ${data.policy.emptyMinutes} 分钟` : '不自动清理'}</td>
            <td>{room.hasPassword ? <span><HiLockClosed />密码房间</span> : '公开'}</td>
            <td><div className="account-room-actions">
              <button type="button" className="account-secondary" disabled={busy} onClick={() => edit(room)}>管理</button>
              <button type="button" className="account-danger" disabled={busy} onClick={() => remove(room)}><HiTrash />移除</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!data.rooms.length && <p className="account-help">暂无房间</p>}
    </>}
    {current && <div className="account-room-editor">
      <h3>{current.name} · {current.id}</h3>
      <p className="account-help">房主 ID：{current.ownerId}</p>
      <p className="account-help">{current.expiresAt ? `空房预计清理：${new Date(current.expiresAt).toLocaleString()}` : current.memberCount ? '房间有人在线，不进行空房清理' : '当前房间不自动清理'}</p>
      <h4>在线成员（{current.members.length}）</h4>
      <ul className="account-room-members">{current.members.map(member => <li key={member.id}>
        {member.avatarUrl ? <img src={member.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <HiUserGroup />}
        <div><strong>{member.username}{member.id === current.ownerId ? '（房主）' : ''}</strong><small>{member.id}</small></div>
      </li>)}</ul>
      {!current.members.length && <p className="account-help">暂无在线成员</p>}
      <form onSubmit={event => {
        event.preventDefault();
        if (!permanent && !window.confirm('保存后，超过所选空房时限的房间可能被自动删除。确定保存吗？')) return;
        void run(async () => {
          await accountRequest(`/api/admin/rooms/${encodeURIComponent(current.id)}`, jsonBody({
            permanent, emptyMinutes: inherit ? null : roomMinutes,
            ...(passwordAction === 'keep' ? {} : { password: passwordAction === 'remove' ? '' : password }),
          }, 'PUT'));
          setPassword(''); setPasswordAction('keep');
          await load(); setMessage('房间配置已保存');
        });
      }}><fieldset disabled={busy}>
        <label className="account-checkbox"><input type="checkbox" checked={permanent} onChange={event => setPermanent(event.target.checked)} />房间永驻</label>
        {!permanent && <>
          <label className="account-checkbox"><input type="checkbox" checked={inherit} onChange={event => setInherit(event.target.checked)} />跟随全局清理时间</label>
          {!inherit && <label>空房清理时间（分钟）<input required type="number" min={1} max={43200} step={1} value={roomMinutes} onChange={event => setRoomMinutes(Number(event.target.value))} /></label>}
        </>}
        <label>房间密码<select value={passwordAction} onChange={event => { setPasswordAction(event.target.value); setPassword(''); }}>
          <option value="keep">保持不变</option><option value="set">设置新密码</option><option value="remove">取消密码</option>
        </select></label>
        {passwordAction === 'set' && <label>新密码<input required type="password" minLength={4} maxLength={64} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>}
        <div className="account-actions">
          <button type="button" className="account-danger" onClick={() => remove(current)}><HiTrash />移除房间</button>
          <button type="button" className="account-secondary" onClick={() => { setSelected(null); setPassword(''); }}>取消编辑</button>
          <button type="submit"><HiSave />保存房间配置</button>
        </div>
      </fieldset></form>
    </div>}
    {selected && data && !current && <p role="status" className="account-help">该房间已移除</p>}
  </section>;
}
