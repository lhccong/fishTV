import { useEffect, useState } from 'react';
import { HiRefresh, HiTrash, HiShieldCheck } from 'react-icons/hi';
import { accountRequest, jsonBody } from '../api/account';

type SiteBan = { id: string; type: 'ip' | 'device'; value: string; reason: string; at: number };

export default function AdminBans({ onError }: { onError: (error: unknown) => void }) {
  const [bans, setBans] = useState<SiteBan[]>([]);
  const [type, setType] = useState<'ip' | 'device'>('ip');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => setBans((await accountRequest<{ bans: SiteBan[] }>('/api/admin/bans')).bans);
  useEffect(() => { void load().catch(onError); }, []);
  const add = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await accountRequest('/api/admin/bans', jsonBody({ type, value: value.trim(), reason: reason.trim() }));
      setValue(''); setReason(''); await load();
    } catch (error) { onError(error); } finally { setBusy(false); }
  };
  const remove = async (ban: SiteBan) => {
    if (busy || !window.confirm(`确定解除对 ${ban.value} 的封禁吗？`)) return;
    setBusy(true);
    try { await accountRequest(`/api/admin/bans/${encodeURIComponent(ban.id)}`, { method: 'DELETE' }); await load(); }
    catch (error) { onError(error); } finally { setBusy(false); }
  };
  return <section className="account-section">
    <div className="account-rooms-heading"><h2><HiShieldCheck />IP / 设备封禁</h2><button type="button" className="account-secondary" disabled={busy} onClick={() => void load().catch(onError)}><HiRefresh />刷新</button></div>
    <div className="account-grid">
      <label>封禁类型<select value={type} onChange={event => setType(event.target.value as 'ip' | 'device')}><option value="ip">IP 地址</option><option value="device">设备标识</option></select></label>
      <label>封禁值<input value={value} maxLength={128} onChange={event => setValue(event.target.value)} placeholder={type === 'ip' ? '例如 203.0.113.10' : '从房间成员信息复制设备标识'} /></label>
    </div>
    <label>原因（可选）<input value={reason} maxLength={160} onChange={event => setReason(event.target.value)} /></label>
    <div className="account-actions"><button type="button" disabled={busy || !value.trim()} onClick={() => void add()}><HiShieldCheck />添加封禁</button></div>
    <div className="account-source-list">
      {bans.map(ban => <div className="account-source-row" key={ban.id}>
        <div><strong>{ban.type === 'ip' ? 'IP' : '设备'}：{ban.value}</strong><span>{ban.reason || '未填写原因'} · {new Date(ban.at).toLocaleString()}</span></div>
        <button type="button" className="account-danger" disabled={busy} onClick={() => void remove(ban)}><HiTrash />解封</button>
      </div>)}
      {!bans.length && <p className="account-help">暂无封禁记录</p>}
    </div>
  </section>;
}
