import { useState, type FormEvent } from 'react';
import { HiCheckCircle, HiDatabase, HiLockClosed } from 'react-icons/hi';
import { accountRequest, jsonBody } from '../api/account';
import '../account.css';

export default function SetupPage({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    redisUrl: '', siteOrigin: window.location.origin,
    clientId: '', clientSecret: '', username: 'admin', password: '',
  });
  const [token, setToken] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [tested, setTested] = useState(false);
  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [name]: event.target.value });
      setTested(false);
      setMessage('');
    },
  });
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') || 'install';
    if (action === 'install' && form.password !== confirmation) { setMessage('两次密码不一致'); return; }
    setBusy(action);
    setMessage('');
    try {
      const options = jsonBody(form);
      await accountRequest(`/api/setup/${action === 'test' ? 'redis-test' : 'install'}`, {
        ...options, headers: { ...options.headers, 'X-Setup-Token': token },
      });
      if (action === 'test') {
        setTested(true);
        setMessage('Redis 连接成功');
      } else {
        setToken('');
        setForm({ ...form, password: '', clientSecret: '' });
        onComplete();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '安装失败');
    } finally { setBusy(''); }
  };
  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-heading">
          <img src="https://oss.cqbo.com/moyu/moyu.png" alt="" width="40" height="40" />
          <div><h1>摸鱼TV</h1><p>首次安装</p></div>
          <span className="account-status">尚未配置</span>
        </header>
        <form onSubmit={submit}>
          <fieldset disabled={Boolean(busy)}>
            <section className="account-section">
              <h2><HiLockClosed />部署验证</h2>
              <label>安装口令<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} maxLength={128} /></label>
              <p className="account-help">安装口令：服务端启动控制台中“首次网页安装口令”的值。</p>
            </section>
            <section className="account-section">
              <h2><HiDatabase />Redis</h2>
              <label>连接地址<input required type="text" inputMode="url" autoComplete="off" maxLength={2048}
                placeholder="redis://用户名:密码@Redis地址:6379/0" {...field('redisUrl')} /></label>
              <p className="account-help">请填写你自己部署的 Redis 地址。Docker 容器内的 127.0.0.1 指向容器自身，不是宿主机 Redis。</p>
              <p className="account-help">示例：redis://:密码@192.168.1.20:6379/0，或使用 rediss:// 开启 TLS。</p>
            </section>
            <section className="account-section">
              <h2>摸鱼岛登录</h2>
              <label>站点地址<input required type="url" maxLength={512} {...field('siteOrigin')} /></label>
              <div className="account-grid">
                <label>Client ID<input required autoComplete="off" maxLength={256} {...field('clientId')} /></label>
                <label>Client Secret<input required type="password" autoComplete="off" maxLength={2048} {...field('clientSecret')} /></label>
              </div>
              <label>OAuth 回调地址<output>{form.siteOrigin.replace(/\/+$/, '')}/api/auth/moyu/callback</output></label>
            </section>
            <section className="account-section">
              <h2>管理员账号</h2>
              <label>账号<input required pattern="[A-Za-z0-9_.@\-]{2,32}" autoComplete="username" maxLength={32} {...field('username')} /></label>
              <div className="account-grid">
                <label>密码<input required type="password" autoComplete="new-password" minLength={8} maxLength={64} {...field('password')} /></label>
                <label>确认密码<input required type="password" autoComplete="new-password" minLength={8} maxLength={64} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
              </div>
            </section>
            <div className="account-actions">
              <button type="submit" value="test" className="account-secondary"><HiDatabase />{busy === 'test' ? '检测中...' : '检测 Redis'}</button>
              <button type="submit" value="install"><HiCheckCircle />{busy === 'install' ? '安装中...' : '完成安装'}</button>
            </div>
          </fieldset>
          {message && <p role="status" className={tested ? 'account-success' : 'account-error'}>{message}</p>}
        </form>
      </div>
    </main>
  );
}
