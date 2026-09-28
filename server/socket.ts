import type { Request } from 'express';
import type { Server as HttpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { getUserSession, type UserSession } from './userAuth.js';
import { mustRedis } from './redis.js';
import { getVideoSource } from './videoSources.js';
import { cookie, digest } from './security.js';
import { expiration, idleMinutes, roomPasswordHash, roomRetention, verifyRoomPassword,
  ROOM_POLICY_KEY, RoomInputError, type RoomRetention, type RoomPolicy } from './roomPolicy.js';

const ROOM_IDS_KEY = 'fishTV:room:ids';
const roomKey = (roomId: string) => `fishTV:room:${roomId}`;
const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;
const MAX_ROOMS = 1000;
const MAX_CHAT_MESSAGES = 100;
const MAX_CHAT_LENGTH = 500;
let pending: Promise<unknown> = Promise.resolve();
let liveIo: Server | null = null;
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
}

type RoomMember = {
  id: string;
  username: string;
  avatarUrl?: string;
  joinedAt: number;
};

type PlaybackState = {
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

type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  createdAt: number;
};

type RoomState = RoomRetention & {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  members: Record<string, RoomMember>;
  playback: PlaybackState | null;
  chat: ChatMessage[];
  playMode?: 'sequential' | 'single' | 'random';
};

type AuthenticatedSocket = Socket & { data: { session: UserSession; roomId?: string } };

function normalizeRoomId(value: unknown) {
  const roomId = String(value || '').trim().toUpperCase();
  return ROOM_ID_PATTERN.test(roomId) ? roomId : '';
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value || '').trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, maxLength);
}

function normalizeMediaUrl(value: unknown) {
  const raw = normalizeText(value, 2048);
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function createRoomId() {
  return randomBytes(3).toString('hex').toUpperCase();
}

function publicRoom(room: RoomState) {
  return {
    id: room.id,
    name: room.name,
    ownerId: room.ownerId,
    createdAt: room.createdAt,
    members: Object.values(room.members),
    memberCount: Object.keys(room.members).length,
    playback: room.playback,
    hasPassword: Boolean(room.passwordHash),
    permanent: Boolean(room.permanent),
    playMode: room.playMode || 'sequential',
  };
}

function profileToMember(session: UserSession): RoomMember {
  return {
    id: session.profile.id,
    username: session.profile.username,
    ...(session.profile.avatarUrl ? { avatarUrl: session.profile.avatarUrl } : {}),
    joinedAt: Date.now(),
  };
}

async function loadRoom(roomId: string) {
  const raw = await mustRedis().get(roomKey(roomId));
  if (!raw) { await mustRedis().sRem(ROOM_IDS_KEY, roomId); return null; }
  let parsed: RoomState;
  try {
    parsed = JSON.parse(raw) as RoomState;
    if (!parsed || parsed.id !== roomId || !parsed.members || !Array.isArray(parsed.chat)) return null;
  } catch {
    return null;
  }
  parsed.playMode = parsed.playMode === 'single' || parsed.playMode === 'random'
    ? parsed.playMode : 'sequential';
  // Redis snapshots may contain members from a previous process; sockets are authoritative.
  if (liveIo) {
    const previousEmptySince = parsed.emptySince;
    const sockets = await liveIo.in(roomId).fetchSockets();
    const members: Record<string, RoomMember> = {};
    for (const client of sockets) {
      const session = client.data.session as UserSession;
      members[session.profile.id] = parsed.members[session.profile.id] || profileToMember(session);
    }
    const changed = JSON.stringify(members) !== JSON.stringify(parsed.members);
    parsed.members = members;
    if (Object.keys(members).length) parsed.emptySince = null;
    else if (parsed.emptySince == null) parsed.emptySince = Date.now();
    if (changed || previousEmptySince !== parsed.emptySince) await saveRoom(parsed);
  }
  const expiresAt = expiration(parsed, await getRoomPolicy());
  if (!Object.keys(parsed.members).length && expiresAt !== null && expiresAt <= Date.now()) {
    await deleteRoom(roomId);
    console.info('[rooms] empty_room_removed');
    return null;
  }
  return parsed;
}

async function saveRoom(room: RoomState) {
  const redis = mustRedis();
  room.emptySince = Object.keys(room.members).length ? null : room.emptySince ?? Date.now();
  await redis.set(roomKey(room.id), JSON.stringify(room));
  await redis.sAdd(ROOM_IDS_KEY, room.id);
}

async function deleteRoom(roomId: string) {
  const redis = mustRedis();
  await redis.del(roomKey(roomId));
  await redis.sRem(ROOM_IDS_KEY, roomId);
}

function ackError(callback: ((response: unknown) => void) | undefined, error: string, code = 'ROOM_REJECTED') {
  callback?.({ success: false, error, code });
}

async function getRoomPolicy(): Promise<RoomPolicy> {
  const raw = await mustRedis().get(ROOM_POLICY_KEY);
  return raw ? { emptyMinutes: idleMinutes(JSON.parse(raw).emptyMinutes, true) } : { emptyMinutes: 0 };
}

function requireRoomRuntime() {
  if (!liveIo) throw new Error('Room service unavailable');
}

export function adminRoomList() {
  return serialize(async () => {
    requireRoomRuntime();
    const policy = await getRoomPolicy();
    const ids = await mustRedis().sMembers(ROOM_IDS_KEY);
    const rooms = [];
    for (const id of ids) {
      const room = await loadRoom(id);
      if (room) rooms.push({ ...publicRoom(room), emptyMinutes: room.emptyMinutes ?? null,
        emptySince: room.emptySince ?? null, expiresAt: expiration(room, policy) });
    }
    return { policy, rooms };
  });
}

export function adminSetRoomPolicy(input: Record<string, unknown>) {
  return serialize(async () => {
    const policy = { emptyMinutes: idleMinutes(input.emptyMinutes, true) };
    await mustRedis().set(ROOM_POLICY_KEY, JSON.stringify(policy));
    console.info('[rooms] policy_updated');
    return policy;
  });
}

export function adminSetRoom(roomId: string, input: Record<string, unknown>) {
  return serialize(async () => {
    requireRoomRuntime();
    const id = normalizeRoomId(roomId);
    const room = id ? await loadRoom(id) : null;
    if (!room) throw new RoomInputError('房间不存在或已过期', 'ROOM_NOT_FOUND', 404);
    const retention = roomRetention(input);
    const passwordHash = input.password === undefined ? room.passwordHash : await roomPasswordHash(input.password);
    Object.assign(room, retention, { passwordHash });
    await saveRoom(room);
    broadcastRoom(liveIo!, room);
    console.info('[rooms] admin_room_updated');
    return { ...publicRoom(room), emptyMinutes: room.emptyMinutes ?? null,
      emptySince: room.emptySince ?? null, expiresAt: expiration(room, await getRoomPolicy()) };
  });
}

export function adminRemoveRoom(roomId: string) {
  return serialize(async () => {
    requireRoomRuntime();
    const id = normalizeRoomId(roomId);
    if (!id) throw new RoomInputError('房间号格式不正确');
    await deleteRoom(id);
    // Notify only current members, then revoke their live room membership.
    liveIo!.to(id).emit('room_removed', { roomId: id, code: 'ROOM_REMOVED', error: '该房间已被管理员移除' });
    for (const socket of liveIo!.sockets.sockets.values()) {
      if (socket.data.roomId === id) delete socket.data.roomId;
    }
    liveIo!.in(id).socketsLeave(id);
    console.info('[rooms] admin_room_removed');
    return { ok: true };
  });
}

function grantKey(socket: AuthenticatedSocket, roomId: string) {
  const sid = cookie({ headers: socket.handshake.headers } as Request, 'fish_tv_user_sid');
  return `fishTV:room:grant:${roomId}:${digest(sid)}`;
}

async function passwordAttempt(socket: AuthenticatedSocket, roomId: string) {
  const key = `fishTV:room:password-attempt:${digest(`${socket.data.session.profile.id}:${roomId}`)}`;
  const redis = mustRedis();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= 10;
}

function socketRoom(socket: AuthenticatedSocket) {
  return socket.data.roomId;
}

function broadcastRoom(io: Server, room: RoomState) {
  io.to(room.id).emit('room_update', publicRoom(room));
}

function requireJoined(socket: AuthenticatedSocket, callback?: (response: unknown) => void) {
  const roomId = socketRoom(socket);
  if (!roomId) {
    ackError(callback, '未加入房间');
    return null;
  }
  return roomId;
}

export function mountSocketServer(httpServer: HttpServer) {
  // Serialize Redis read/modify/write operations within this single server.
  const io = new Server(httpServer, {
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 64 * 1024,
  });
  liveIo = io;
  let sweeping = false;
  const sweep = setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    void adminRoomList().catch(() => console.warn('[rooms] cleanup_failed')).finally(() => { sweeping = false; });
  }, 30000);
  sweep.unref();
  httpServer.on('close', () => { clearInterval(sweep); if (liveIo === io) liveIo = null; });

  io.use(async (socket, next) => {
    try {
      const request = {
        headers: { cookie: String(socket.handshake.headers.cookie || '') },
      } as Request;
      const session = await getUserSession(request);
      if (!session) {
        next(new Error('LOGIN_REQUIRED'));
        return;
      }
      (socket as AuthenticatedSocket).data.session = session;
      next();
    } catch {
      next(new Error('AUTH_UNAVAILABLE'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const session = socket.data.session;
    let queued = 0;
    let eventCount = 0;
    let windowStart = Date.now();
    const handle = (event: string, handler: (payload: any, callback: (response: any) => void) => Promise<void>) => {
      socket.on(event, (...args: unknown[]) => {
        const last = args[args.length - 1];
        const reply = typeof last === 'function' ? last as (response: unknown) => void : () => {};
        const payload = typeof args[0] === 'function' ? undefined : args[0];
        if (Date.now() - windowStart > 60000) { eventCount = 0; windowStart = Date.now(); }
        if (++eventCount > 180 || queued >= 12) {
          reply({ success: false, code: 'RATE_LIMITED', error: '操作过于频繁，请稍后重试' });
          return;
        }
        queued++;
        void serialize(async () => {
          try {
            if (!socket.connected) return;
            const current = await getUserSession({ headers: socket.handshake.headers } as Request);
            if (!current || current.profile.id !== session.profile.id) {
              reply({ success: false, code: 'LOGIN_REQUIRED', error: '登录已失效，请重新登录' });
              socket.disconnect(true);
              return;
            }
            await handler(payload, reply);
          } catch (error) {
            if (error instanceof RoomInputError) {
              reply({ success: false, code: error.code, error: error.message });
              return;
            }
            console.warn(`[rooms] ${event}_failed`);
            reply({ success: false, code: 'SERVICE_UNAVAILABLE', error: '房间服务暂不可用，请重试' });
          } finally { queued--; }
        });
      });
    };

    handle('list_rooms', async (_payload, callback) => {
      try {
        const ids = await mustRedis().sMembers(ROOM_IDS_KEY);
        const rooms = (await Promise.all(ids.slice(0, MAX_ROOMS).map(loadRoom)))
          .filter((room): room is RoomState => Boolean(room))
          .map(room => ({ ...publicRoom(room), members: [], playback: room.passwordHash ? null : room.playback }));
        callback?.({ success: true, rooms });
      } catch {
        ackError(callback, '房间服务暂不可用');
      }
    });

    handle('create_room', async (payload, callback) => {
      const ids = await mustRedis().sMembers(ROOM_IDS_KEY);
      for (const roomId of ids) {
        const existing = await loadRoom(roomId);
        if (existing && existing.ownerId === session.profile.id) {
          console.info('[rooms] create_duplicate_denied');
          callback({ success: false, code: 'ROOM_ALREADY_OWNED', error: '你已经创建了一个房间，请进入已有房间', roomId: existing.id });
          return;
        }
      }
      if ((await mustRedis().sCard(ROOM_IDS_KEY)) >= MAX_ROOMS) {
        ackError(callback, '房间数量已达上限，请稍后重试', 'ROOM_LIMIT');
        return;
      }
      const passwordHash = await roomPasswordHash(payload?.password ?? '');
        const name = normalizeText(payload?.name, 80) || `${session.profile.username} 的房间`;
        let id = '';
        for (let i = 0; i < 5 && !id; i += 1) {
          const candidate = createRoomId();
          if (!(await mustRedis().exists(roomKey(candidate)))) id = candidate;
        }
        if (!id) {
          ackError(callback, '房间创建失败，请稍后重试');
          return;
        }
        const room: RoomState = {
          id,
          name,
          ownerId: session.profile.id,
          createdAt: Date.now(),
          members: {},
          playback: null,
          chat: [],
          permanent: false,
          emptyMinutes: null,
          emptySince: Date.now(),
          passwordHash,
          playMode: 'sequential',
        };
        await saveRoom(room);
        callback?.({ success: true, room: publicRoom(room) });
    });

    handle('join_room', async (payload, callback) => {
      try {
        const roomId = normalizeRoomId(payload?.roomId);
        if (!roomId) {
          ackError(callback, '房间号格式不正确');
          return;
        }
        const room = await loadRoom(roomId);
        if (!room) {
          ackError(callback, '房间不存在或已过期', 'ROOM_NOT_FOUND');
          return;
        }
        if (room.passwordHash && room.ownerId !== session.profile.id &&
          await mustRedis().get(grantKey(socket, roomId)) !== digest(room.passwordHash)) {
          if (payload?.password === undefined || payload.password === '') {
            ackError(callback, '该房间需要密码', 'ROOM_PASSWORD_REQUIRED');
            return;
          }
          if (!(await passwordAttempt(socket, roomId))) {
            console.info('[rooms] password_limited');
            ackError(callback, '密码尝试过于频繁，请稍后重试', 'RATE_LIMITED');
            return;
          }
          if (!(await verifyRoomPassword(payload.password, room.passwordHash))) {
            console.info('[rooms] password_denied');
            ackError(callback, '房间密码错误', 'ROOM_PASSWORD_INVALID');
            return;
          }
          await mustRedis().set(grantKey(socket, roomId), digest(room.passwordHash), { EX: 7 * 24 * 60 * 60 });
          console.info('[rooms] password_accepted');
        }
        if (!socket.connected) {
          return;
        }
        const previousRoomId = socketRoom(socket);
        if (previousRoomId && previousRoomId !== roomId) {
          await socket.leave(previousRoomId);
          const previousRoom = await loadRoom(previousRoomId);
          const remaining = await io.in(previousRoomId).fetchSockets();
          if (previousRoom && !remaining.some(item => item.data.session?.profile.id === session.profile.id)) {
            delete previousRoom.members[session.profile.id];
            await saveRoom(previousRoom);
            broadcastRoom(io, previousRoom);
          }
        }
        room.members[session.profile.id] = profileToMember(session);
        await saveRoom(room);
        await socket.join(roomId);
        socket.data.roomId = roomId;
        callback?.({ success: true, room: publicRoom(room), messages: room.chat.slice(-50) });
        broadcastRoom(io, room);
      } catch {
        ackError(callback, '加入房间失败');
      }
    });

    handle('set_room_password', async (payload, callback) => {
      const id = requireJoined(socket, callback);
      if (!id) return;
      const room = await loadRoom(id);
      if (!room || room.ownerId !== session.profile.id) {
        ackError(callback, '只有房主可以修改密码', 'ROOM_FORBIDDEN');
        return;
      }
      room.passwordHash = await roomPasswordHash(payload?.password);
      await saveRoom(room);
      broadcastRoom(io, room);
      console.info('[rooms] owner_password_updated');
      callback({ success: true, room: publicRoom(room) });
    });

    handle('set_play_mode', async (payload, callback) => {
      const id = requireJoined(socket, callback);
      if (!id) return;
      const room = await loadRoom(id);
      if (!room || room.ownerId !== session.profile.id) {
        ackError(callback, '只有房主可以修改播放设置', 'ROOM_FORBIDDEN');
        return;
      }
      const mode = payload?.mode;
      if (mode !== 'sequential' && mode !== 'single' && mode !== 'random') {
        ackError(callback, '播放设置无效', 'INVALID_PLAY_MODE');
        return;
      }
      room.playMode = mode;
      await saveRoom(room);
      broadcastRoom(io, room);
      callback({ success: true, room: publicRoom(room) });
    });

    handle('leave_room', async (_payload, callback) => {
      const roomId = socketRoom(socket);
      if (!roomId) {
        callback?.({ success: true });
        return;
      }
      const room = await loadRoom(roomId);
      await socket.leave(roomId);
      await mustRedis().del(grantKey(socket, roomId));
      delete socket.data.roomId;
      const remaining = await io.in(roomId).fetchSockets();
      if (room && !remaining.some(item => item.data.session?.profile.id === session.profile.id)) {
        delete room.members[session.profile.id];
        await saveRoom(room);
        broadcastRoom(io, room);
      }
      callback?.({ success: true });
    });

    handle('dissolve_room', async (_payload, callback) => {
      const roomId = requireJoined(socket, callback);
      if (!roomId) return;
      const room = await loadRoom(roomId);
      if (!room || room.ownerId !== session.profile.id) {
        ackError(callback, '只有房主可以解散房间', 'ROOM_FORBIDDEN');
        return;
      }
      await deleteRoom(roomId);
      io.to(roomId).emit('room_removed', {
        roomId,
        code: 'ROOM_DISSOLVED',
        error: '房主已解散该房间',
      });
      for (const memberSocket of io.sockets.sockets.values()) {
        if (memberSocket.data.roomId === roomId) delete memberSocket.data.roomId;
      }
      io.in(roomId).socketsLeave(roomId);
      console.info('[rooms] owner_room_dissolved');
      callback?.({ success: true });
    });

    handle('set_playback', async (payload, callback) => {
      const roomId = requireJoined(socket, callback);
      if (!roomId) return;
      const room = await loadRoom(roomId);
      if (!room || room.ownerId !== session.profile.id) {
        ackError(callback, '只有房主可以控制共同播放');
        return;
      }
      const videoId = normalizeText(payload?.videoId, 128);
      const sourceId = normalizeText(payload?.sourceId, 128);
      const videoUrl = normalizeMediaUrl(payload?.videoUrl);
      const episode = Number(payload?.episode);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(videoId) || !getVideoSource(sourceId) || !videoUrl ||
          typeof payload?.playing !== 'boolean' || !Number.isFinite(payload?.positionSeconds) ||
          !Number.isInteger(episode) || episode < 1 || episode > 10000) {
        ackError(callback, '播放信息无效');
        return;
      }
      room.playback = {
        videoId,
        sourceId,
        episode,
        videoUrl,
        playing: Boolean(payload?.playing),
        positionSeconds: Math.max(0, Math.min(Number(payload?.positionSeconds) || 0, 24 * 60 * 60)),
        updatedAt: Date.now(),
        revision: (room.playback?.revision || 0) + 1,
        title: normalizeText(payload?.title, 160),
      };
      await saveRoom(room);
      callback?.({ success: true, playback: room.playback });
      io.to(roomId).emit('playback_state', room.playback);
      broadcastRoom(io, room);
    });

    handle('set_playback_clock', async (payload, callback) => {
      const roomId = requireJoined(socket, callback);
      if (!roomId) return;
      const room = await loadRoom(roomId);
      if (!room || room.ownerId !== session.profile.id || !room.playback) {
        ackError(callback, '只有房主可以控制共同播放');
        return;
      }
      if (!Number.isFinite(payload?.positionSeconds) || typeof payload?.playing !== 'boolean') {
        ackError(callback, '播放进度无效');
        return;
      }
      if (payload?.revision !== undefined && payload.revision !== room.playback.revision) {
        callback({ success: false, code: 'STALE_PLAYBACK', error: '播放状态已更新', playback: room.playback });
        return;
      }
      const positionSeconds = Math.max(0, Math.min(Number(payload?.positionSeconds) || 0, 24 * 60 * 60));
      room.playback = {
        ...room.playback,
        playing: Boolean(payload?.playing),
        positionSeconds,
        updatedAt: Date.now(),
        revision: room.playback.revision + 1,
      };
      await saveRoom(room);
      callback?.({ success: true, playback: room.playback });
      io.to(roomId).emit('playback_state', room.playback);
    });

    handle('advance_playback', async (payload, callback) => {
      const roomId = requireJoined(socket, callback);
      if (!roomId) return;
      const room = await loadRoom(roomId);
      if (!room || room.ownerId !== session.profile.id || !room.playback) {
        ackError(callback, '只有房主可以控制共同播放');
        return;
      }
      if (room.playMode === 'single') {
        ackError(callback, '当前播放设置不会自动连播', 'PLAY_MODE_SINGLE');
        return;
      }
      if (!Number.isInteger(payload?.expectedRevision) || payload.expectedRevision !== room.playback.revision) {
        callback({ success: false, code: 'STALE_PLAYBACK', error: '播放状态已更新', playback: room.playback });
        return;
      }
      const videoId = normalizeText(payload?.videoId, 128);
      const sourceId = normalizeText(payload?.sourceId, 128);
      const videoUrl = normalizeMediaUrl(payload?.videoUrl);
      const episode = Number(payload?.episode);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(videoId) || !getVideoSource(sourceId) || !videoUrl ||
          typeof payload?.playing !== 'boolean' || !Number.isFinite(payload?.positionSeconds) ||
          !Number.isInteger(episode) || episode < 1 || episode > 10000) {
        ackError(callback, '播放信息无效');
        return;
      }
      room.playback = {
        videoId,
        sourceId,
        episode,
        videoUrl,
        playing: Boolean(payload.playing),
        positionSeconds: Math.max(0, Math.min(Number(payload.positionSeconds) || 0, 24 * 60 * 60)),
        updatedAt: Date.now(),
        revision: room.playback.revision + 1,
        title: normalizeText(payload.title, 160),
      };
      await saveRoom(room);
      callback?.({ success: true, playback: room.playback });
      io.to(roomId).emit('playback_state', room.playback);
      broadcastRoom(io, room);
    });

    handle('send_chat', async (payload, callback) => {
      const roomId = requireJoined(socket, callback);
      if (!roomId) return;
      const text = normalizeText(payload?.text, MAX_CHAT_LENGTH);
      if (!text) {
        ackError(callback, '消息不能为空');
        return;
      }
      const room = await loadRoom(roomId);
      if (!room) {
        ackError(callback, '房间不存在');
        return;
      }
      const message: ChatMessage = {
        id: randomBytes(12).toString('base64url'),
        userId: session.profile.id,
        username: session.profile.username,
        ...(session.profile.avatarUrl ? { avatarUrl: session.profile.avatarUrl } : {}),
        text,
        createdAt: Date.now(),
      };
      room.chat = [...room.chat, message].slice(-MAX_CHAT_MESSAGES);
      await saveRoom(room);
      callback?.({ success: true, message });
      io.to(roomId).emit('chat_message', message);
    });

    handle('load_chat_history', async (_payload, callback) => {
      const roomId = requireJoined(socket, callback);
      if (!roomId) return;
      const room = await loadRoom(roomId);
      if (!room) {
        ackError(callback, '房间不存在');
        return;
      }
      callback?.({ success: true, messages: room.chat.slice(-MAX_CHAT_MESSAGES) });
    });

    socket.on('disconnect', () => {
      void serialize(async () => {
        const roomId = socketRoom(socket);
        if (!roomId) return;
        try {
          const room = await loadRoom(roomId);
          if (!room) return;
          const remaining = await io.in(roomId).fetchSockets();
          if (!remaining.some(item => item.data.session?.profile.id === session.profile.id)) {
            delete room.members[session.profile.id];
            await saveRoom(room);
            broadcastRoom(io, room);
          }
        } catch { console.warn('[rooms] disconnect_cleanup_failed'); }
      });
    });
  });

  return io;
}
