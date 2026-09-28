import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft, HiChatAlt2, HiFilm, HiLogout, HiPlay, HiSearch, HiTrash, HiUserCircle, HiUserGroup, HiDesktopComputer, HiSparkles, HiMicrophone, HiVideoCamera, HiServer } from 'react-icons/hi';
import { useCurrentUser } from '../context/AccessGate';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { VIDEO_SOURCES } from '../api/config';
import { getVideoDetail, getVideoList } from '../api/video';
import type { Video } from '../api/types';
import { allEpisodes, isRoomMedia, roomEpisodes } from '../lib/roomVideo';
import RoomVideoPlayer from '../components/RoomVideoPlayer';
import RoomInvite from '../components/RoomInvite';
import RoomSettings from '../components/RoomSettings';
import RoomMembers from '../components/RoomMembers';
import RoomChatComposer from '../components/RoomChatComposer';
import ChatMessageText from '../components/ChatMessageText';
import '../watch-room.css';

const categories = [{ id: 6, name: '电影', icon: HiFilm }, { id: 13, name: '电视剧', icon: HiDesktopComputer }, { id: 29, name: '动漫', icon: HiSparkles }, { id: 25, name: '综艺', icon: HiMicrophone }, { id: 36, name: '短剧', icon: HiVideoCamera }];

export default function WatchRoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { room, playback, messages, liveMessages, connected, joinFailure, error: socketError, joinRoom, leaveRoom, dissolveRoom, setRoomPlayback, advanceRoomPlayback, setRoomPlayMode, setPlaybackClock, setPlaybackRate, sendChat } = useRoomSocket();
  const joined = room?.id === roomId.toUpperCase();
  const owner = joined && (room.ownerId === user?.id || Boolean(user?.id && room.adminIds?.includes(user.id)));
  const [activePanel, setActivePanel] = useState<'invite' | 'settings' | 'members' | null>(null);
  const actions = useRef<HTMLElement>(null);
  const [joinError, setJoinError] = useState('');
  const [joinAttempt, setJoinAttempt] = useState(0);
  const [roomPassword, setRoomPassword] = useState('');
  const [joiningWithPassword, setJoiningWithPassword] = useState(false);
  const passwordRequired = joinFailure?.roomId === roomId.toUpperCase() &&
    ['ROOM_PASSWORD_REQUIRED', 'ROOM_PASSWORD_INVALID'].includes(joinFailure.code || '');
  const roomRemoved = joinFailure?.roomId === roomId.toUpperCase() &&
    ['ROOM_REMOVED', 'ROOM_KICKED'].includes(joinFailure.code || '');
  const [source, setSource] = useState(Object.keys(VIDEO_SOURCES)[0] || '');
  const [category, setCategory] = useState(6);
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [results, setResults] = useState<Video[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Video | null>(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [episode, setEpisode] = useState(1);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [media, setMedia] = useState<{ key: string; url: string; title: string } | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [playModeSaving, setPlayModeSaving] = useState(false);
  const autoAdvance = useRef(false);
  const chatScroll = useRef<HTMLDivElement>(null);
  const followChat = useRef(true);
  const mediaKey = playback ? `${playback.sourceId}:${playback.videoId}:${playback.episode}` : '';
  const selection = allEpisodes(selected || { vod_play_url: '' } as Video);
  const playableSelection = selection.filter(item => isRoomMedia(item.url));

  useEffect(() => { setActivePanel(null); }, [roomId, joined, owner]);
  useEffect(() => {
    if (!activePanel) return;
    const dismiss = (event: PointerEvent) => {
      if (activePanel === 'settings') return;
      const target = event.target;
      if (!(target instanceof Element) || !actions.current?.contains(target) || !target.closest('.watch-invite')) {
        setActivePanel(null);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [activePanel]);

  useEffect(() => {
    if (!connected || joined || passwordRequired || roomRemoved) return;
    let cancelled = false;
    setJoinError('');
    void joinRoom(roomId).then(result => { if (!cancelled && !result.success) setJoinError(result.error || '加入房间失败'); });
    return () => { cancelled = true; };
  }, [connected, joined, joinRoom, roomId, joinAttempt, passwordRequired, roomRemoved]);

  useEffect(() => { setRoomPassword(''); setJoinError(''); }, [roomId]);

  useEffect(() => {
    if (!owner || !VIDEO_SOURCES[source]) return;
    let cancelled = false;
    setSearching(true); setCatalogError(''); setSelected(null);
    const timeout = window.setTimeout(() => { cancelled = true; setSearching(false); setCatalogError('片库加载超时，请重试'); }, 12000);
    void getVideoList({ pg: page, t: keyword ? undefined : category, wd: keyword || undefined }, VIDEO_SOURCES[source].url)
      .then(result => {
        if (cancelled) return;
        setResults(result.list || []); setPages(Math.max(1, Number(result.pagecount) || 1));
      })
      .catch(() => { if (!cancelled) { setResults([]); setCatalogError('片库加载失败，请重试或切换视频源'); } })
      .finally(() => { clearTimeout(timeout); if (!cancelled) setSearching(false); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [owner, source, category, keyword, page, catalogAttempt]);

  useEffect(() => {
    if (!joined || !playback) { setMedia(null); setPlayingVideo(null); return; }
    const current = playback;
    const config = VIDEO_SOURCES[current.sourceId];
    setMedia(null); setMediaError('');
    if (!config) { setMediaError('当前视频源不可用，请房主重新选片'); return; }
    let cancelled = false;
    const timeout = window.setTimeout(() => { cancelled = true; setMediaError('影片加载超时，请重试'); }, 12000);
    // Resolve the media through the configured catalogue, never navigate to a URL supplied by a member.
    void getVideoDetail(current.videoId, config.url).then(result => {
      if (cancelled) return;
      const video = result.list?.[0];
      const episode = video && roomEpisodes(video)[current.episode - 1];
      setPlayingVideo(video || null);
      if (!video || !episode || !isRoomMedia(episode.url)) { setMediaError('该集暂不支持共同播放，请房主切换影片'); return; }
      if (owner && !current.cover && video.vod_pic) {
        void setRoomPlayback({
          videoId: current.videoId,
          sourceId: current.sourceId,
          episode: current.episode,
          videoUrl: episode.url,
          title: current.title || video.vod_name,
          cover: video.vod_pic,
          positionSeconds: current.positionSeconds,
          playing: current.playing,
        });
      }
      setMedia({ key: mediaKey, url: episode.url, title: video.vod_name });
    }).catch(() => { if (!cancelled) setMediaError('影片加载失败，请重试'); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [joined, mediaKey, mediaAttempt, owner, setRoomPlayback]);

  const changePlayingEpisode = async (nextEpisode: number) => {
    if (!owner || !playback || !playingVideo || busy) return;
    const item = allEpisodes(playingVideo)[nextEpisode - 1];
    if (!item || !isRoomMedia(item.url)) return;
    setBusy(true);
    setError('');
    try {
      const result = await setRoomPlayback({
        videoId: playback.videoId,
        sourceId: playback.sourceId,
        episode: nextEpisode,
        videoUrl: item.url,
        title: playingVideo.vod_name,
        cover: playingVideo.vod_pic,
        positionSeconds: 0,
        playing: true,
      });
      if (!result.success) setError(result.error || '切换集数失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  const playMode = room?.playMode || 'sequential';
  const playNextEpisode = async () => {
    if (!owner || !playingVideo || !playback || autoAdvance.current) return;
    autoAdvance.current = true;
    const stopAtEnd = async () => {
      let result = await setPlaybackClock(playback.positionSeconds, false, playback.revision);
      if (!result.success && result.code === 'STALE_PLAYBACK' && result.playback) {
        result = await setPlaybackClock(result.playback.positionSeconds, false, result.playback.revision);
      }
      if (!result.success && result.code !== 'STALE_PLAYBACK') setError(result.error || '停止播放失败，请重试');
    };
    if (playMode === 'single') {
      await stopAtEnd();
      autoAdvance.current = false;
      return;
    }
    const episodes = allEpisodes(playingVideo).map((item, index) => ({ item, index }))
      .filter(({ item }) => isRoomMedia(item.url));
    if (!episodes.length) {
      autoAdvance.current = false;
      return;
    }
    let nextIndex = -1;
    if (playMode === 'random') {
      const choices = episodes.filter(({ index }) => index !== playback.episode - 1);
      if (choices.length) nextIndex = choices[Math.floor(Math.random() * choices.length)].index;
    } else {
      const currentIndex = episodes.findIndex(({ index }) => index === playback.episode - 1);
      if (currentIndex >= 0 && currentIndex + 1 < episodes.length) nextIndex = episodes[currentIndex + 1].index;
    }
    if (nextIndex < 0) {
      await stopAtEnd();
      autoAdvance.current = false;
      return;
    }
    const next = episodes.find(({ index }) => index === nextIndex)?.item;
    if (!next) {
      autoAdvance.current = false;
      return;
    }
    const requestNext = (expectedRevision: number) => advanceRoomPlayback({
      expectedRevision,
      videoId: playback.videoId,
      sourceId: playback.sourceId,
      episode: nextIndex + 1,
      videoUrl: next.url,
      title: playingVideo.vod_name,
      cover: playingVideo.vod_pic,
      positionSeconds: 0,
      playing: true,
    });
    let result = await requestNext(playback.revision);
    if (!result.success && result.code === 'STALE_PLAYBACK' && result.playback &&
      result.playback.videoId === playback.videoId && result.playback.sourceId === playback.sourceId &&
      result.playback.episode === playback.episode) {
      result = await requestNext(result.playback.revision);
    }
    if (!result.success && result.code !== 'STALE_PLAYBACK' && result.code !== 'PLAY_MODE_SINGLE') {
      setError(result.error || '自动切换失败，请重试');
    }
    autoAdvance.current = false;
  };

  useEffect(() => {
    const container = chatScroll.current;
    if (container && followChat.current) container.scrollTop = container.scrollHeight;
  }, [messages.length]);
  const choose = async (video: Video) => {
    setBusy(true); setError('');
    try {
      const result = await getVideoDetail(String(video.vod_id), VIDEO_SOURCES[source].url);
      if (!result.list?.[0]) throw new Error('影片详情不存在');
      // 部分片源的详情接口不返回封面，保留搜索结果中的图片用于房间卡片。
      const detail = {
        ...result.list[0],
        vod_pic: result.list[0].vod_pic || video.vod_pic,
      };
      const episodes = allEpisodes(detail);
      const firstPlayable = episodes.findIndex(item => isRoomMedia(item.url));
      setSelected(detail); setSelectedSource(source); setEpisode(firstPlayable >= 0 ? firstPlayable + 1 : 1);
    } catch { setError('影片详情加载失败，请重试'); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!selected || busy || !selection[episode - 1] || !isRoomMedia(selection[episode - 1].url)) return;
    setBusy(true); setError('');
    const result = await setRoomPlayback({
      videoId: String(selected.vod_id), sourceId: selectedSource, episode,
      videoUrl: selection[episode - 1].url, title: selected.vod_name,
      cover: selected.vod_pic,
      positionSeconds: 0, playing: true,
    });
    setBusy(false);
    if (result.success) setPicker(false);
    else setError(result.error || '共同播放失败，请重试');
  };

  return <main className="watch-room no-invert">
    <header className="watch-header">
      <div className="watch-brand"><img src="https://oss.cqbo.com/moyu/moyu.png" alt="摸鱼 TV" />
        <div><h1>{joined ? room.name : '观影房间'}</h1><p>房间号 {roomId.toUpperCase()} <span className={connected ? 'watch-online' : ''}>{connected ? '已连接' : '连接中'}</span></p></div>
      </div>
      <nav ref={actions} className="watch-actions">
        {joined && <RoomInvite key={room.id} roomId={room.id} open={activePanel === 'invite'} onOpenChange={open => setActivePanel(open ? 'invite' : null)} />}
        {owner && <RoomSettings key={room.id} open={activePanel === 'settings'} onOpenChange={open => setActivePanel(open ? 'settings' : null)} />}
        {owner && <button className="watch-danger-action" disabled={!connected} onClick={async () => {
          if (!window.confirm('解散后房间、播放记录和聊天记录都会被删除，在线成员也会被移出。确定解散房间吗？')) return;
          const result = await dissolveRoom();
          if (result.success) navigate('/rooms'); else setError(result.error || '解散房间失败');
        }}><HiTrash />解散房间</button>}
        <button disabled={!joined || !connected} onClick={async () => {
          const result = await leaveRoom();
          if (result.success) navigate('/rooms'); else setError(result.error || '退出失败');
        }}><HiLogout />退出房间</button>
        {joined ? <RoomMembers room={room} userId={user?.id} open={activePanel === 'members'} onOpenChange={open => setActivePanel(open ? 'members' : null)} /> : <span><HiUserGroup />0 人在线</span>}
      </nav>
    </header>
    {(error || socketError) && <p className="watch-error" role="alert">{error || socketError}</p>}
    {!joined ? <section className="watch-wait"><HiFilm /><h2>{roomRemoved ? '房间已移除' : passwordRequired ? '输入房间密码' : joinError ? '无法进入房间' : '正在加入房间'}</h2>
      {roomRemoved ? <><p role="alert">{joinFailure.error}</p><Link to="/rooms">返回放映室</Link></> : passwordRequired ? <form className="watch-password-form" onSubmit={async event => {
        event.preventDefault(); if (joiningWithPassword) return;
        setJoiningWithPassword(true); setJoinError('');
        try {
          const result = await joinRoom(roomId, roomPassword);
          setRoomPassword('');
          if (!result.success) setJoinError(result.error || '加入失败');
        } finally { setJoiningWithPassword(false); }
      }}>
        <label>房间密码<input required autoFocus type="password" autoComplete="off" minLength={4} maxLength={64} value={roomPassword} onChange={event => setRoomPassword(event.target.value)} /></label>
        <button className="watch-primary" disabled={!connected || joiningWithPassword} type="submit">{joiningWithPassword ? '正在加入...' : '加入房间'}</button>
        {joinError && <p role="alert">{joinError}</p>}
      </form> : joinError && <><p role="alert">{joinError}</p><button onClick={() => setJoinAttempt(value => value + 1)}>重试</button></>}</section> :
      <div className={`watch-columns ${owner ? '' : 'watch-guest'}`}>
        {owner && <aside className="watch-catalog-nav">
          <div className="watch-section-label"><HiFilm />片库</div>
          <nav aria-label="影片分类">{categories.map(item => <button key={item.id} aria-pressed={category === item.id && !keyword} onClick={() => { setCategory(item.id); setKeyword(''); setQuery(''); setPage(1); setPicker(true); }}><item.icon aria-hidden="true" /><span>{item.name}</span></button>)}</nav>
          <label className="watch-source"><span><HiServer aria-hidden="true" />视频源</span><select value={source} onChange={event => { setSource(event.target.value); setPage(1); setPicker(true); }}>{Object.entries(VIDEO_SOURCES).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
          {playingVideo && <label className="watch-play-mode"><span><HiPlay aria-hidden="true" />播放设置</span><select aria-label="播放设置" value={playMode} disabled={!owner || busy || !connected || playModeSaving} onChange={event => {
            setPlayModeSaving(true);
            void setRoomPlayMode(event.target.value as NonNullable<typeof playMode>).then(result => {
              if (!result.success) setError(result.error || '播放设置保存失败');
            }).finally(() => setPlayModeSaving(false));
          }}><option value="sequential">自动连播</option><option value="single">单个播放</option><option value="random">随机播放</option></select></label>}
          {playingVideo && <section className="watch-episodes" aria-label="当前影片集数">
            <div className="watch-section-label"><HiFilm />选集<span>{allEpisodes(playingVideo).length} 集</span></div>
            <div className="watch-episode-list">
              {allEpisodes(playingVideo).map((item, index) => {
                const episodeNumber = index + 1;
                const playable = isRoomMedia(item.url);
                return <button key={`${episodeNumber}:${item.url}`} type="button"
                  className={playback?.episode === episodeNumber ? 'is-current' : ''}
                  disabled={!playable || busy}
                  onClick={() => void changePlayingEpisode(episodeNumber)}
                  title={playable ? item.name : '该集不支持共同播放'}>
                  <span>{item.name || `第 ${episodeNumber} 集`}</span>
                  {!playable && <small>不可同步</small>}
                </button>;
              })}
            </div>
          </section>}
        </aside>}
        <section className={`watch-main ${owner && (!playback || picker) ? 'watch-browsing' : ''}`}>
          {playback && <div className="watch-now">
            <div><span className="watch-kicker">共同观看</span><h2>{media?.title || playback.title || '正在加载影片'} <small>第 {playback.episode} 集</small></h2></div>
            {owner && <button onClick={() => setPicker(value => !value)}><HiFilm />{picker ? '收起选片' : '更换影片'}</button>}
          </div>}
          {playback ? <>
            {media?.key === mediaKey ? <RoomVideoPlayer key={mediaKey} url={media.url} playback={playback} owner={owner} connected={connected}
              canSetPlaybackRate={room.ownerId === user?.id} onPlaybackRateChange={setPlaybackRate}
              playMode={playMode} onPlayModeChange={setRoomPlayMode}
              messages={messages} liveMessages={liveMessages} userId={user?.id} sendChat={sendChat}
              onEnded={() => void playNextEpisode()}
              onClock={async (position, playing, revision) => {
                const result = await setPlaybackClock(position, playing, revision);
                if (!result.success && result.code !== 'STALE_PLAYBACK') setError(result.error || '播放同步失败');
              }} /> : <div className="watch-screen-empty"><HiFilm /><h2>{mediaError ? '暂时无法播放' : '正在加载影片'}</h2>{mediaError && <><p role="alert">{mediaError}</p><button onClick={() => setMediaAttempt(value => value + 1)}>重新加载</button></>}</div>}
          </> : !owner && <div className="watch-screen-empty watch-awaiting"><HiFilm /><h2>暂无播放</h2><p>等待房主选片</p><span className="watch-waiting-dots" aria-hidden="true">● ● ●</span></div>}
          {owner && (!playback || picker) && <section className="watch-picker">
            <div className="watch-picker-heading"><h2>选片</h2><span>{keyword ? '搜索结果' : categories.find(item => item.id === category)?.name}</span></div>
            <form className="watch-search" onSubmit={event => { event.preventDefault(); setKeyword(query.trim()); setPage(1); setCatalogAttempt(value => value + 1); }}>
              <HiSearch /><input aria-label="搜索影片" placeholder="搜索电影、电视剧、动漫..." maxLength={100} value={query} onChange={event => setQuery(event.target.value)} /><button type="submit">搜索</button>
            </form>
            {selected && <div className="watch-selection">
              <img src={selected.vod_pic} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
              <div><h3>{selected.vod_name}</h3><p>{selected.vod_year} · {selected.vod_area}</p>
                {selection.length ? <label>集数<select aria-label="选择集数" value={episode} onChange={event => setEpisode(Number(event.target.value))}>{selection.map((item, index) => <option key={index} value={index + 1}>{item.name}{isRoomMedia(item.url) ? '' : '（暂不支持共同播放）'}</option>)}</select></label> : <p role="alert">该影片暂无可用集数，请切换视频源</p>}
                {selection.length > 0 && playableSelection.length === 0 && <p role="alert">该影片的集数不是可同步的直链，请切换视频源</p>}
                <button className="watch-primary" disabled={busy || !connected || !isRoomMedia(selection[episode - 1]?.url || '')} onClick={() => void publish()}><HiPlay />共同播放</button>
              </div>
            </div>}
            {searching ? <div className="watch-empty" role="status"><svg className="watch-spinner" width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="60" opacity="0.25"/><circle cx="20" cy="20" r="16" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeDasharray="80" strokeDashoffset="60"><animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="1s" repeatCount="indefinite"/></circle></svg><p style={{marginTop:'16px',fontSize:'14px',color:'#cbd5e1'}}>正在加载片库...</p></div> : catalogError ? <div className="watch-empty"><svg style={{fontSize:'48px',color:'#ef4444',marginBottom:'8px'}} viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg><p role="alert">{catalogError}</p><button onClick={() => setCatalogAttempt(value => value + 1)}>重试</button></div> : !results.length ? <div className="watch-empty"><HiFilm style={{fontSize:'56px',color:'#6b7280',marginBottom:'12px'}}/><p>暂无影片</p></div> :
              <div className={`watch-film-grid ${searching ? 'watch-searching' : ''}`}>{results.map(video => <button key={video.vod_id} className="watch-film" disabled={busy} onClick={() => void choose(video)}>
                <div className="watch-poster"><HiFilm /><img src={video.vod_pic} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /><span>{video.vod_year || video.type_name}</span></div>
                <div className="watch-film-meta">
                  <strong>{video.vod_name}</strong>
                  <small>{video.vod_area || video.type_name}</small>
                </div>
              </button>)}</div>}
            <div className="watch-pagination"><button disabled={page <= 1 || searching} onClick={() => setPage(value => value - 1)}>上一页</button><span>{page} / {pages}</span><button disabled={page >= pages || searching} onClick={() => setPage(value => value + 1)}>下一页</button></div>
          </section>}
        </section>
        <aside className="watch-chat">
          <div className="watch-chat-heading"><h2><HiChatAlt2 />聊天室</h2><span>{room.memberCount} 人</span></div>
          <div className="watch-messages" ref={chatScroll} role="log" aria-label="聊天消息" onScroll={event => {
            const container = event.currentTarget;
            followChat.current = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
          }}>
            {messages.length === 0 && <div className="watch-chat-empty"><HiChatAlt2 /><p>暂无消息</p></div>}
            {messages.map(message => <article className={`watch-message ${message.userId === user?.id ? 'watch-message-self' : ''}`} key={message.id}>
              {message.avatarUrl ? <img src={message.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <HiUserCircle />}
              <div className="watch-message-content">
                <header><strong>{message.username}</strong></header>
                <p><ChatMessageText text={message.text} /></p>
                <time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
            </article>)}
          </div>
          <RoomChatComposer connected={connected} sendChat={sendChat} label="聊天内容"
            placeholder="聊聊这部影片..." onSent={() => { followChat.current = true; }} />
        </aside>
      </div>}
  </main>;
}
