import { createContext, createElement, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useCurrentUser } from '../context/AccessGate';

export type RoomMember = {
  id: string;
  username: string;
  avatarUrl?: string;
  joinedAt: number;
};

export type RoomPlayback = {
  videoId: string;
  sourceId: string;
  episode: number;
  videoUrl: string;
  playing: boolean;
  positionSeconds: number;
  updatedAt: number;
  revision: number;
  title?: string;
};

export type RoomChatMessage = {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  createdAt: number;
};

export type RoomSummary = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  members: RoomMember[];
  memberCount: number;
  playback: RoomPlayback | null;
  hasPassword?: boolean;
  permanent?: boolean;
};
type JoinResponse = { success: boolean; room?: RoomSummary; messages?: RoomChatMessage[]; error?: string; code?: string };

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

  const applyJoinedRoom = useCallback((response: { success: boolean; room?: RoomSummary; messages?: RoomChatMessage[]; error?: string }) => {
    if (!response.success || !response.room) return;
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
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
    const response = await emit<JoinResponse>(
      'join_room',
      { roomId: normalizedRoomId, ...(password !== undefined ? { password } : {}) },
    );
    joinInFlight.current = false;
    if (desiredRoom.current !== normalizedRoomId) return response;
    if (response.success && response.room) {
      applyJoinedRoom(response);
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
  }, [applyJoinedRoom, emit, scheduleRoomRetry]);

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
      setRoom(null);
      setPlayback(null);
      setMessages([]);
      setLiveMessages([]);
      setJoinFailure(null);
    }
    return response;
  }, [emit]);

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
    const result = await emit<{ success: boolean; playback?: RoomPlayback; error?: string }>('set_playback', payload);
    if (result.success && result.playback) setPlayback(result.playback);
    return result;
  }, [emit]);
  const setRoomPassword = useCallback(async (password: string) => {
    const result = await emit<{ success: boolean; room?: RoomSummary; error?: string }>('set_room_password', { password });
    if (result.success && result.room) setRoom(result.room);
    return result;
  }, [emit]);

  const setPlaybackClock = useCallback(async (positionSeconds: number, playing: boolean, revision?: number) => {
    const result = await emit<{ success: boolean; playback?: RoomPlayback; error?: string; code?: string }>(
      'set_playback_clock',
      { positionSeconds, playing, revision },
    );
    if (result.playback) {
      const next = result.playback;
      setPlayback(current => !current || next.revision >= current.revision ? next : current);
    }
    return result;
  }, [emit]);

  const sendChat = useCallback((text: string) => (
    emit<{ success: boolean; message?: RoomChatMessage; error?: string }>('send_chat', { text })
  ), [emit]);

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
      setConnected(true);
      setError('');
      if (desiredRoom.current) void joinRoom(desiredRoom.current);
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setLiveMessages([]);
      if (desiredRoom.current) setError('房间连接已断开，正在自动重连...');
    });
    socket.on('connect_error', (reason) => {
      setConnected(false);
      setError(reason.message === 'LOGIN_REQUIRED' ? '请先登录摸鱼岛' : '房间连接中，正在自动重试...');
    });
    socket.on('room_update', (nextRoom: RoomSummary) => {
      setRoom(nextRoom);
      if (nextRoom.playback) setPlayback(nextRoom.playback);
    });
    socket.on('room_removed', (event: { roomId: string; error?: string }) => {
      if (event.roomId !== activeRoom.current && event.roomId !== desiredRoom.current) return;
      desiredRoom.current = null;
      activeRoom.current = null;
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
    socket.on('playback_state', (nextPlayback: RoomPlayback) => setPlayback(nextPlayback));
    socket.on('chat_message', (message: RoomChatMessage) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message].slice(-100));
      setLiveMessages(current => current.some(item => item.id === message.id) ? current : [...current, message].slice(-40));
    });
    return () => {
      desiredRoom.current = null;
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [joinRoom, user?.id]);

  return {
    connected,
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
    setRoomPlayback,
    setRoomPassword,
    setPlaybackClock,
    sendChat,
    loadChatHistory,
    listRooms,
  };
}
