import { createContext, createElement, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useCurrentUser } from '../context/AccessGate';
import { getClientNetworkInfo } from '../lib/clientNetworkInfo';
import { createRoomClock } from '../lib/roomClock';

export type RoomMember = {
  id: string;
  username: string;
  avatarUrl?: string;
  location?: string;
  clientIp?: string;
  deviceId?: string;
  joinedAt: number;
};

export type RoomPlayback = {
  videoId: string;
  sourceId: string;
  episode: number;
  videoUrl: string;
  playing: boolean;
  positionSeconds: number;
  playbackRate?: number;
  updatedAt: number;
  revision: number;
  title?: string;
  cover?: string;
};

export type DanmakuEffect = 
  | 'normal'      // 普通（默认）
  | 'rainbow'     // 彩虹渐变
  | 'glow'        // 发光效果
  | 'shake'       // 抖动效果
  | 'wave'        // 波浪效果
  | 'zoom';       // 缩放动画

export type RoomChatMessage = {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  createdAt: number;
  // 新增弹幕样式字段
  color?: string;           // 弹幕颜色（十六进制，如 #FF0000）
  effect?: DanmakuEffect;   // 弹幕特效
  isPermanentVip?: boolean; // VIP 标识（用于显示 VIP 徽章）
  titleName?: string;       // 称号（用于显示）
};

export type RoomSummary = {
  id: string;
  name: string;
  ownerId: string;
  adminIds?: string[];
  createdAt: number;
  members: RoomMember[];
  memberCount: number;
  playback: RoomPlayback | null;
  hasPassword?: boolean;
  permanent?: boolean;
  playMode?: 'sequential' | 'single' | 'random';
};
type JoinResponse = { success: boolean; room?: RoomSummary; messages?: RoomChatMessage[]; error?: string; code?: string };
export type RoomClockResult = { success: boolean; playback?: RoomPlayback; error?: string; code?: string };

const RoomContext = createContext<ReturnType<typeof useRoomConnection> | null>(null);

export function useRoomSocket() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('RoomProvider missing');
  return context;
}

export function RoomProvider({ children }: { children: ReactNode }) {
  return createElement(RoomContext.Provider, { value: useRoomConnection() }, children);
}

function useRoomConnection() {
  const user = useCurrentUser();
  const activeRoom = useRef<string | null>(null);
  const desiredRoom = useRef<string | null>(null);
  const joinInFlight = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const retryCount = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const clock = useRef(createRoomClock());
  const clockSyncPending = useRef(false);
  const clockGeneration = useRef(0);
  const [clockReporter, setClockReporter] = useState(false);
  const getServerNow = useCallback(() => clock.current.now(), []);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [liveMessages, setLiveMessages] = useState<RoomChatMessage[]>([]);
  const [playback, setPlayback] = useState<RoomPlayback | null>(null);
  const [error, setError] = useState('');
  const [joinFailure, setJoinFailure] = useState<{ roomId: string; code?: string; error: string } | null>(null);

  const emit = useCallback(<T,>(event: string, payload?: unknown) => new Promise<T>((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      resolve({ success: false, error: '房间连接尚未建立' } as T);
      return;
    }
    const callback = (err: Error | null, response: T) => {
      resolve(err || !response ? ({ success: false, error: '请求超时或服务未响应，请重试' } as T) : response);
    };
    if (payload === undefined) socket.timeout(8000).emit(event, callback);
    else socket.timeout(8000).emit(event, payload, callback);
  }), []);

  const syncRoomClock = useCallback(async () => {
    if (clockSyncPending.current || !socketRef.current?.connected || !activeRoom.current) return;
    clockSyncPending.current = true;
    const generation = clockGeneration.current;
    const roomId = activeRoom.current;
    const startedAt = performance.now();
    try {
      const result = await emit<{ success: boolean; serverReceivedAt: number; serverSentAt: number; reporter: boolean }>('sync_room_clock');
      if (generation !== clockGeneration.current || roomId !== activeRoom.current) return;
      setClockReporter(result.success && result.reporter === true);
      if (result.success) clock.current.sample(startedAt, performance.now(), result.serverReceivedAt, result.serverSentAt);
    } finally {
      if (generation === clockGeneration.current) clockSyncPending.current = false;
    }
  }, [emit]);

  const applyJoinedRoom = useCallback((response: { success: boolean; room?: RoomSummary; messages?: RoomChatMessage[]; error?: string }) => {
    if (!response.success || !response.room) return;
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (activeRoom.current !== response.room.id) {
      clockGeneration.current++;
      clockSyncPending.current = false;
      setClockReporter(false);
    }
    activeRoom.current = response.room.id;
    setRoom(response.room);
    setPlayback(response.room.playback);
    setMessages(response.messages || []);
    setLiveMessages([]);
    retryCount.current = 0;
    setError('');
    setJoinFailure(null);
  }, []);

  const scheduleRoomRetry = useCallback((roomId: string, retry: () => void) => {
    if (retryTimer.current !== null || !desiredRoom.current) return;
    const delay = Math.min(1000 * (2 ** retryCount.current), 8000);
    retryCount.current += 1;
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      if (desiredRoom.current === roomId) retry();
    }, delay);
  }, []);

  const createRoom = useCallback(async (name: string, password = '') => {
    return emit<{ success: boolean; room?: RoomSummary; error?: string; code?: string; roomId?: string }>('create_room', { name, password });
  }, [emit]);

  const joinRoom = useCallback(async (roomId: string, password?: string): Promise<JoinResponse> => {
    const normalizedRoomId = roomId.trim().toUpperCase();
    desiredRoom.current = normalizedRoomId;
    if (joinInFlight.current) {
      return { success: false, code: 'JOIN_BUSY', error: '正在重新连接房间' };
    }
    joinInFlight.current = true;
    const networkInfo = await getClientNetworkInfo();
    const response = await emit<JoinResponse>('join_room', {
      roomId: normalizedRoomId,
      playbackRateSupported: true,
      playbackClockSupported: true,
      ...(password !== undefined ? { password } : {}),
      ...(networkInfo.location ? { clientLocation: networkInfo.location } : {}),
    });
    joinInFlight.current = false;
    if (desiredRoom.current !== normalizedRoomId) return response;
    if (response.success && response.room) {
      applyJoinedRoom(response);
      void syncRoomClock();
    } else if (response.code === 'ROOM_PASSWORD_REQUIRED' || response.code === 'ROOM_PASSWORD_INVALID' || response.code === 'ROOM_NOT_FOUND') {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      setJoinFailure({ roomId: normalizedRoomId, code: response.code, error: response.error || '加入房间失败' });
      setRoom(current => current?.id === normalizedRoomId ? null : current);
      setPlayback(null);
      setMessages([]);
      setLiveMessages([]);
      setError('');
      if (response.code === 'ROOM_NOT_FOUND') desiredRoom.current = null;
    } else if (desiredRoom.current === normalizedRoomId && (
      response.error?.includes('超时') ||
      response.error?.includes('尚未建立') ||
      !socketRef.current?.connected
    )) {
      setError('房间连接中，正在自动重试...');
      scheduleRoomRetry(normalizedRoomId, () => void joinRoom(normalizedRoomId));
    }
    return response;
  }, [applyJoinedRoom, emit, scheduleRoomRetry, syncRoomClock]);

  const leaveRoom = useCallback(async () => {
    desiredRoom.current = null;
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    retryCount.current = 0;
    const response = await emit<{ success: boolean; error?: string }>('leave_room');
    if (response.success) {
      activeRoom.current = null;
      setClockReporter(false);
      setRoom(null);
      setPlayback(null);
      setMessages([]);
      setLiveMessages([]);
      setJoinFailure(null);
    }
    return response;
  }, [emit]);
  const dissolveRoom = useCallback(async () => (
    emit<{ success: boolean; error?: string; code?: string }>('dissolve_room')
  ), [emit]);

  const cancelJoin = useCallback((roomId: string) => {
    const id = roomId.trim().toUpperCase();
    if (desiredRoom.current !== id || joinInFlight.current) return;
    desiredRoom.current = activeRoom.current !== id ? activeRoom.current : null;
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
    retryCount.current = 0;
    setJoinFailure(current => current?.roomId === id ? null : current);
    setError('');
  }, []);

  const setRoomPlayback = useCallback(async (payload: Omit<RoomPlayback, 'updatedAt' | 'revision'>) => {
    const result = await emit<{ success: boolean; playback?: RoomPlayback; error?: string; code?: string }>('set_playback', payload);
    if (result.success && result.playback) setPlayback(result.playback);
    return result;
  }, [emit]);
  const advanceRoomPlayback = useCallback(async (payload: Omit<RoomPlayback, 'updatedAt' | 'revision'> & { expectedRevision: number }) => {
    const result = await emit<{ success: boolean; playback?: RoomPlayback; error?: string; code?: string }>('advance_playback', payload);
    if (result.success && result.playback) setPlayback(result.playback);
    return result;
  }, [emit]);
  const setRoomPassword = useCallback(async (password: string) => {
    const result = await emit<{ success: boolean; room?: RoomSummary; error?: string }>('set_room_password', { password });
    if (result.success && result.room) setRoom(result.room);
    return result;
  }, [emit]);
  const setRoomName = useCallback(async (name: string) => {
    const result = await emit<{ success: boolean; room?: RoomSummary; error?: string }>('set_room_name', { name });
    if (result.success && result.room) setRoom(result.room);
    return result;
  }, [emit]);
  const setRoomAdmins = useCallback(async (adminIds: string[]) => {
    const result = await emit<{ success: boolean; room?: RoomSummary; error?: string }>('set_room_admins', { adminIds });
    if (result.success && result.room) setRoom(result.room);
    return result;
  }, [emit]);
  const kickMember = useCallback(async (memberId: string) => {
    const result = await emit<{ success: boolean; room?: RoomSummary; error?: string }>('kick_member', { memberId });
    if (result.success && result.room) setRoom(result.room);
    return result;
  }, [emit]);
  const setRoomPlayMode = useCallback(async (mode: NonNullable<RoomSummary['playMode']>) => {
    const result = await emit<{ success: boolean; room?: RoomSummary; error?: string }>('set_play_mode', { mode });
    if (result.success && result.room) setRoom(result.room);
    return result;
  }, [emit]);

  const setPlaybackClock = useCallback(async (positionSeconds: number, playing: boolean, revision?: number, kind: 'control' | 'heartbeat' = 'control') => {
    const result = await emit<RoomClockResult>(
      'set_playback_clock',
      { positionSeconds, playing, revision, kind },
    );
    if (result.playback) {
      const next = result.playback;
      setPlayback(current => !current || next.revision >= current.revision ? next : current);
    }
    return result;
  }, [emit]);

  const sendChat = useCallback((text: string, color?: string, effect?: DanmakuEffect) => (
    emit<{ success: boolean; message?: RoomChatMessage; error?: string }>('send_chat', { text, color, effect })
  ), [emit]);

  const setPlaybackRate = useCallback(async (playbackRate: number, positionSeconds: number, revision: number) => {
    const result = await emit<{ success: boolean; playback?: RoomPlayback; error?: string; code?: string }>(
      'set_playback_rate', { playbackRate, positionSeconds, revision },
    );
    if (result.playback) {
      const next = result.playback;
      setPlayback(current => !current || next.revision >= current.revision ? next : current);
    }
    return result;
  }, [emit]);

  const loadChatHistory = useCallback(() => (
    emit<{ success: boolean; messages?: RoomChatMessage[]; error?: string }>('load_chat_history')
  ), [emit]);
  const listRooms = useCallback(() => (
    emit<{ success: boolean; rooms?: RoomSummary[]; error?: string }>('list_rooms')
  ), [emit]);

  useEffect(() => {
    if (!user) return;
    const socket = io({
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 8000,
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      clockGeneration.current++;
      clockSyncPending.current = false;
      clock.current.reset();
      setClockReporter(false);
      setConnected(true);
      setError('');
      if (desiredRoom.current) void joinRoom(desiredRoom.current);
    });
    socket.on('disconnect', () => {
      clockGeneration.current++;
      clockSyncPending.current = false;
      setClockReporter(false);
      setConnected(false);
      setLiveMessages([]);
      if (desiredRoom.current) setError('房间连接已断开，正在自动重连...');
    });
    socket.on('connect_error', (reason) => {
      setConnected(false);
      if (reason.message === 'SITE_BANNED') {
        socket.io.reconnection(false);
        setError('当前访问受到限制');
      } else {
        setError(reason.message === 'LOGIN_REQUIRED' ? '请先登录摸鱼岛' : '房间连接中，正在自动重试...');
      }
    });
    socket.on('kicked', (event: { roomId?: string; code?: string; message?: string; stopReconnect?: boolean }) => {
      if (event.stopReconnect || event.code === 'SITE_BANNED') socket.io.reconnection(false);
      if (event.code === 'ROOM_KICKED') {
        desiredRoom.current = null;
        activeRoom.current = null;
        setClockReporter(false);
        if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
        retryCount.current = 0;
        setRoom(null);
        setPlayback(null);
        setMessages([]);
        setLiveMessages([]);
        setJoinFailure({
          roomId: event.roomId || '',
          code: event.code,
          error: event.message || '你已被房主移出房间',
        });
        setError('');
        return;
      }
      setConnected(false);
      setError(event.message || '当前连接已被断开');
    });
    socket.on('room_update', (nextRoom: RoomSummary) => {
      setRoom(nextRoom);
      if (nextRoom.playback) {
        const next = nextRoom.playback;
        setPlayback(current => !current || next.revision >= current.revision ? next : current);
      }
    });
    socket.on('room_removed', (event: { roomId: string; error?: string }) => {
      if (event.roomId !== activeRoom.current && event.roomId !== desiredRoom.current) return;
      desiredRoom.current = null;
      activeRoom.current = null;
      setClockReporter(false);
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryCount.current = 0;
      setRoom(null);
      setPlayback(null);
      setMessages([]);
      setLiveMessages([]);
      setError('');
      setJoinFailure({ roomId: event.roomId, code: 'ROOM_REMOVED', error: event.error || '该房间已被移除' });
    });
    socket.on('playback_state', (next: RoomPlayback) => {
      setPlayback(current => !current || next.revision >= current.revision ? next : current);
    });
    socket.on('chat_message', (message: RoomChatMessage) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message].slice(-100));
      setLiveMessages(current => current.some(item => item.id === message.id) ? current : [...current, message].slice(-40));
    });
    const clockTimer = window.setInterval(() => void syncRoomClock(), 10000);
    const resyncClock = () => {
      if (document.visibilityState === 'visible') void syncRoomClock();
    };
    document.addEventListener('visibilitychange', resyncClock);
    return () => {
      window.clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', resyncClock);
      clockGeneration.current++;
      clockSyncPending.current = false;
      desiredRoom.current = null;
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [joinRoom, syncRoomClock, user?.id]);

  return {
    connected,
    clockReporter,
    getServerNow,
    error,
    joinFailure,
    room,
    messages,
    liveMessages,
    playback,
    createRoom,
    joinRoom,
    cancelJoin,
    leaveRoom,
    dissolveRoom,
    setRoomPlayback,
    advanceRoomPlayback,
    setRoomPassword,
    setRoomName,
    setRoomAdmins,
    kickMember,
    setRoomPlayMode,
    setPlaybackClock,
    setPlaybackRate,
    sendChat,
    loadChatHistory,
    listRooms,
  };
}
