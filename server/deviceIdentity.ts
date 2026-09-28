import { randomBytes } from 'node:crypto';

export const DEVICE_COOKIE = 'fish_tv_device_id';

export function sanitizeDeviceId(value: unknown) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{16,64}$/.test(id) ? id : '';
}

export function createDeviceId() {
  return randomBytes(24).toString('base64url');
}

export function getDeviceIdFromCookie(cookieHeader: string | undefined) {
  for (const part of String(cookieHeader || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0 || part.slice(0, index).trim() !== DEVICE_COOKIE) continue;
    try { return sanitizeDeviceId(decodeURIComponent(part.slice(index + 1).trim())); } catch { return ''; }
  }
  return '';
}
