import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HiLogout, HiSave, HiRefresh, HiLogin, HiChartBar, HiUserGroup, HiFilm, HiCog, HiShieldCheck } from 'react-icons/hi';
import { AccountError, accountRequest, jsonBody } from '../api/account';
import AdminRooms from '../components/AdminRooms';
import AdminBans from '../components/AdminBans';
import '../account.css';

type Overview = { username: string; redis: { connected: boolean }; server: { uptimeSeconds: number } };
type Config = { siteOrigin: string; clientId: string; clientSecretConfigured: boolean; callbackUrl: string; redisConfigured: boolean };
type VideoSource = { id: string; name: string; url: string; enabled: boolean; builtIn?: boolean; proxyUrl: string };
const sections = [
  { id: 'overview', label: '运行概览', icon: HiChartBar },
  { id: 'rooms', label: '房间管理', icon: HiUserGroup },
  { id: 'bans', label: 'IP / 设备封禁', icon: HiShieldCheck },
  { id: 'sources', label: '视频源', icon: HiFilm },
  { id: 'settings', label: '站点配置', icon: HiCog },
  { id: 'account', label: '管理员账号', icon: HiShieldCheck },
];

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = sections.find(section => section.id === searchParams.get('view')) || sections[0];
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [secret, setSecret] = useState('');
  const [configPassword, setConfigPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [sourceForm, setSourceForm] = useState({ id: '', name: '', url: '', enabled: true });

  const report = (error: unknown) => {
    setSuccess(false);
    setMessage(error instanceof Error ? error.message : '服务暂不可用');
    if (error instanceof AccountError && error.status === 401) setLoggedIn(false);
  };
  const load = async () => {
    await accountRequest('/api/admin/session');
    const [summary, settings, videoSettings] = await Promise.all([
      accountRequest<Overview>('/api/admin/overview'),
      accountRequest<Config>('/api/admin/config'),
      accountRequest<{ sources: VideoSource[] }>('/api/admin/video-sources'),
    ]);
    setOverview(summary);
    setConfig(settings);
    setSources(videoSettings.sources);
    setNewUsername(summary.username);
    setLoggedIn(true);
  };
  useEffect(() => { void load().catch(error => {
    if (error instanceof AccountError && error.status === 401) setLoggedIn(false);
    else report(error);
  }); }, []);

  const run = async (name: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    setMessage('');
    setSuccess(false);
    try { await operation(); } catch (error) { report(error); } finally { setBusy(''); }
  };
  const login = (event: FormEvent) => {
    event.preventDefault();
    void run('login', async () => {
      await accountRequest('/api/admin/login', jsonBody({ username, password }));
      setPassword('');
      await load();
    });
  };
  const logout = () => void run('logout', async () => {
    await accountRequest('/api/admin/logout', { method: 'POST' });
    setLoggedIn(false);
    setOverview(null);
    setConfig(null);
    setSecret('');
    setConfigPassword('');
    setCurrentPassword('');
    setNewPassword('');
  });
  const saveConfig = (event: FormEvent) => {
    event.preventDefault();
    void run('config', async () => {
      await accountRequest('/api/admin/config', jsonBody({
        siteOrigin: config?.siteOrigin, clientId: config?.clientId, clientSecret: secret,
        currentPassword: configPassword,
      }, 'PUT'));
      setSecret('');
      setConfigPassword('');
      setSuccess(true);
      setMessage('配置已保存，普通用户需重新登录。');
      if (config?.siteOrigin && config.siteOrigin !== window.location.origin) {
        window.location.assign(`${config.siteOrigin}/admin`);
      } else await load();
    });
  };
  const changeCredentials = (event: FormEvent) => {
    event.preventDefault();
    void run('credentials', async () => {
      await accountRequest('/api/admin/credentials', jsonBody({ username: newUsername, password: newPassword, currentPassword }, 'PUT'));
      setLoggedIn(false);
      setNewPassword('');
      setCurrentPassword('');
      setUsername(newUsername);
      setSuccess(true);
      setMessage('账号已更新，所有后台会话已失效，请重新登录。');
    });
  };
  const resetSourceForm = () => setSourceForm({ id: '', name: '', url: '', enabled: true });
  const saveSource = (event: FormEvent) => {
    event.preventDefault();
    void run('source', async () => {
      const editing = sources.some((source) => source.id === sourceForm.id);
      const response = await accountRequest<{ source: VideoSource }>(
        editing ? `/api/admin/video-sources/${encodeURIComponent(sourceForm.id)}` : '/api/admin/video-sources',
        jsonBody(sourceForm, editing ? 'PUT' : 'POST'),
      );
      setSources((current) => editing
        ? current.map((source) => source.id === response.source.id ? response.source : source)
        : [...current, response.source]);
      resetSourceForm();
      setSuccess(true);
      setMessage('视频源已保存。');
    });
  };
  const editSource = (source: VideoSource) => setSourceForm({
    id: source.id, name: source.name, url: source.url, enabled: source.enabled,
  });
  const toggleSource = (source: VideoSource) => {
    void run('source', async () => {
      const response = await accountRequest<{ source: VideoSource }>(
        `/api/admin/video-sources/${encodeURIComponent(source.id)}`,
        jsonBody({ ...source, enabled: !source.enabled }, 'PUT'),
      );
      setSources((current) => current.map((item) => item.id === source.id ? response.source : item));
    });
  };
  const deleteSource = (source: VideoSource) => {
    if (!window.confirm(`确定删除视频源“${source.name}”吗？`)) return;
    void run('source', async () => {
      await accountRequest(`/api/admin/video-sources/${encodeURIComponent(source.id)}`, { method: 'DELETE' });
      setSources((current) => current.filter((item) => item.id !== source.id));
    });
  };
  const notice = message && <p role="status" className={success ? 'account-success' : 'account-error'}>{message}</p>;

  if (loggedIn === null) return <main className="account-page account-centered"><div className="account-login"><h1>摸鱼TV 后台</h1>
    {message ? <>{notice}<button onClick={() => void run('load', load)} disabled={Boolean(busy)}><HiRefresh />重新连接</button></> : <p role="status">正在检查后台会话...</p>}
  </div></main>;
  if (!loggedIn) return <main className="account-page account-centered">
    <div className="account-login">
      <img src="https://oss.cqbo.com/moyu/moyu.png" alt="" width="48" height="48" /><h1>摸鱼TV 后台</h1>
      <form onSubmit={login}><fieldset disabled={Boolean(busy)}>
        <label>管理员账号<input required autoComplete="username" maxLength={32} value={username} onChange={e => setUsername(e.target.value)} /></label>
        <label>密码<input required type="password" autoComplete="current-password" maxLength={64} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button><HiLogin />{busy ? '登录中...' : '登录后台'}</button>
      </fieldset></form>{notice}
      <Link className="account-link" to="/">返回摸鱼TV</Link>
    </div>
  </main>;

  return <main className="account-page account-admin"><div className="account-shell account-admin-shell">
    <header className="account-heading">
      <img src="https://oss.cqbo.com/moyu/moyu.png" alt="" width="40" height="40" /><div><h1>摸鱼TV 后台</h1><Link to="/" className="account-link">返回主站</Link></div>
      <button style={{ marginLeft: 'auto' }} className="account-secondary" disabled={Boolean(busy)} onClick={logout}><HiLogout />退出</button>
    </header>
    <div className="account-admin-layout">
    <nav className="account-nav" aria-label="后台菜单">
      {sections.map(section => <button key={section.id} type="button" aria-current={active.id === section.id ? 'page' : undefined} disabled={Boolean(busy)} onClick={() => {
        setSearchParams({ view: section.id });
        setMessage('');
        setSecret(''); setConfigPassword(''); setCurrentPassword(''); setNewPassword('');
      }}><section.icon />{section.label}</button>)}
    </nav>
    <div className="account-admin-content">
    {notice}
    {active.id === 'overview' && <section className="account-overview">
    <div className="account-rooms-heading"><h2>运行概览</h2><button className="account-secondary" disabled={Boolean(busy)} onClick={() => void run('load', load)}><HiRefresh />刷新</button></div>
    <dl className="account-metrics">
      <div><dt>管理员</dt><dd>{overview?.username}</dd></div>
      <div><dt>Redis</dt><dd className="account-success">{overview?.redis.connected ? '已连接' : '不可用'}</dd></div>
      <div><dt>运行时间</dt><dd>{Math.floor((overview?.server.uptimeSeconds || 0) / 60)} 分钟</dd></div>
    </dl>
    <dl className="account-metrics">
      <div><dt>视频源</dt><dd>{sources.length} 个</dd></div>
      <div><dt>已启用</dt><dd>{sources.filter(source => source.enabled).length} 个</dd></div>
      <div><dt>登录配置</dt><dd>{config?.clientSecretConfigured ? '已配置' : '未配置'}</dd></div>
    </dl>
    </section>}
    {active.id === 'rooms' && <AdminRooms onError={report} />}
    {active.id === 'bans' && <AdminBans onError={report} />}
    {active.id === 'settings' && <form onSubmit={saveConfig} className="account-section"><fieldset disabled={Boolean(busy) || !config}>
      <h2>站点与登录配置</h2>
      <label>站点地址<input required type="url" maxLength={512} value={config?.siteOrigin || ''} onChange={e => setConfig(config && { ...config, siteOrigin: e.target.value })} /></label>
      <div className="account-grid">
        <label>Client ID<input required maxLength={256} autoComplete="off" value={config?.clientId || ''} onChange={e => setConfig(config && { ...config, clientId: e.target.value })} /></label>
        <label>Client Secret{config?.clientSecretConfigured ? '（已配置，留空不变）' : ''}<input required={!config?.clientSecretConfigured} type="password" autoComplete="new-password" maxLength={2048} value={secret} onChange={e => setSecret(e.target.value)} /></label>
      </div>
      <p className="account-static">OAuth 回调地址：<code>{config?.siteOrigin.replace(/\/+$/, '')}/api/auth/moyu/callback</code></p>
      <label>当前管理员密码<input required type="password" autoComplete="current-password" maxLength={64} value={configPassword} onChange={e => setConfigPassword(e.target.value)} /></label>
      <div className="account-actions"><button><HiSave />{busy === 'config' ? '保存中...' : '保存配置'}</button></div>
    </fieldset></form>}
    {active.id === 'account' && <form onSubmit={changeCredentials} className="account-section"><fieldset disabled={Boolean(busy)}>
      <h2>管理员凭据</h2>
      <label>新账号<input required pattern="[A-Za-z0-9_.@\-]{2,32}" autoComplete="username" maxLength={32} value={newUsername} onChange={e => setNewUsername(e.target.value)} /></label>
      <div className="account-grid">
        <label>新密码<input required type="password" autoComplete="new-password" minLength={8} maxLength={64} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
        <label>当前密码<input required type="password" autoComplete="current-password" maxLength={64} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
      </div>
      <div className="account-actions"><button><HiSave />{busy === 'credentials' ? '更新中...' : '更新账号'}</button></div>
    </fieldset></form>}
    {active.id === 'sources' && <section className="account-section">
      <h2>视频地址管理</h2>
      <p className="account-help">旧视频地址会保留在列表中；停用后不会展示给用户，内置地址不能删除，只能停用。</p>
      <form onSubmit={saveSource}>
        <fieldset disabled={Boolean(busy)}>
          <div className="account-grid">
            <label>标识<input required pattern="[a-z0-9][a-z0-9_-]{1,31}" disabled={sources.some((source) => source.id === sourceForm.id)} value={sourceForm.id} onChange={e => setSourceForm({ ...sourceForm, id: e.target.value.toLowerCase() })} placeholder="例如 newsource" /></label>
            <label>名称<input required maxLength={64} value={sourceForm.name} onChange={e => setSourceForm({ ...sourceForm, name: e.target.value })} placeholder="例如 新视频源" /></label>
          </div>
          <label>视频接口地址<input required type="url" maxLength={2048} value={sourceForm.url} onChange={e => setSourceForm({ ...sourceForm, url: e.target.value })} placeholder="https://example.com/api.php" /></label>
          <label className="account-checkbox"><input type="checkbox" checked={sourceForm.enabled} onChange={e => setSourceForm({ ...sourceForm, enabled: e.target.checked })} />启用此视频源</label>
          <div className="account-actions">
            {sourceForm.id && <button type="button" className="account-secondary" onClick={resetSourceForm}>取消编辑</button>}
            <button><HiSave />{busy === 'source' ? '保存中...' : '保存视频源'}</button>
          </div>
        </fieldset>
      </form>
      <div className="account-source-list">
        {sources.map((source) => <div className={`account-source-row ${source.enabled ? '' : 'is-disabled'}`} key={source.id}>
          <div className="min-w-0"><strong>{source.name}</strong><span>{source.id}</span><code>{source.url}</code></div>
          <div className="account-source-actions">
            <button type="button" className="account-secondary" onClick={() => editSource(source)}>编辑</button>
            <button type="button" className="account-secondary" onClick={() => toggleSource(source)}>{source.enabled ? '停用' : '启用'}</button>
            {!source.builtIn && <button type="button" className="account-secondary" onClick={() => deleteSource(source)}>删除</button>}
          </div>
        </div>)}
      </div>
    </section>}
    </div>
    </div>
  </div></main>;
}
