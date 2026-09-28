import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const ROOM_POLICY_KEY = 'fishTV:room:policy';
export const MAX_IDLE_MINUTES = 43200;
export type RoomPolicy = { emptyMinutes: number };
export type RoomRetention = {
  permanent?: boolean;
  emptyMinutes?: number | null;
  emptySince?: number | null;
  passwordHash?: string;
};

export class RoomInputError extends Error {
  constructor(message: string, public code = 'INVALID_ROOM_CONFIG', public status = 400) { super(message); }
}

export function idleMinutes(value: unknown, allowZero = false) {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < (allowZero ? 0 : 1) || value > MAX_IDLE_MINUTES) {
    throw new RoomInputError(`清理时间需为 ${allowZero ? '0' : '1'}-${MAX_IDLE_MINUTES} 分钟`);
  }
  return value;
}

export function roomRetention(input: Record<string, unknown>) {
  if (typeof input.permanent !== 'boolean') throw new RoomInputError('永驻选项无效');
  return {
    permanent: input.permanent,
    emptyMinutes: input.emptyMinutes === null ? null : idleMinutes(input.emptyMinutes),
  };
}

export function expiration(room: RoomRetention, policy: RoomPolicy) {
  const minutes = room.emptyMinutes ?? policy.emptyMinutes;
  return room.permanent || !minutes || room.emptySince == null ? null : room.emptySince + minutes * 60000;
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 32, (error, key) => error ? reject(error) : resolve(key)));
}

export async function roomPasswordHash(value: unknown) {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length < 4 || value.length > 64) {
    throw new RoomInputError('房间密码需为 4-64 位，留空可取消密码', 'INVALID_ROOM_PASSWORD');
  }
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(value, salt)).toString('hex')}`;
}

export async function verifyRoomPassword(value: unknown, hash: string) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 64) return false;
  const [salt, expected] = hash.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(expected || '')) return false;
  return timingSafeEqual(await derive(value, salt), Buffer.from(expected, 'hex'));
}
