import type { Request } from 'express';
import type { Socket } from 'socket.io';
import { isIP } from 'node:net';

function normalizeIp(value: unknown) {
  let ip = String(value || '').trim().replace(/^::ffff:/, '');
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  const withPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (withPort) ip = withPort[1];
  return isIP(ip) ? ip : '';
}

function forwardedHeader(headers: Record<string, unknown>, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getClientIpFromHeaders(headers: Record<string, unknown> = {}, remoteAddress = '') {
  // 只有显式配置了可信代理时才读取转发头，避免客户端伪造 IP 绕过封禁。
  if (process.env.TRUST_PROXY === '1') {
    const configured = String(process.env.CLIENT_IP_HEADER || '').trim().toLowerCase();
    const custom = configured ? normalizeIp(forwardedHeader(headers, configured)) : '';
    if (custom) return custom;
    const real = normalizeIp(forwardedHeader(headers, 'x-real-ip'));
    if (real) return real;
    const forwarded = String(forwardedHeader(headers, 'x-forwarded-for') || '').split(',').at(-1);
    const last = normalizeIp(forwarded);
    if (last) return last;
  }
  return normalizeIp(remoteAddress);
}

export function getRequestIp(req: Request) {
  return getClientIpFromHeaders(req.headers as Record<string, unknown>, req.socket?.remoteAddress || req.ip);
}

export function getSocketIp(socket: Socket) {
  return getClientIpFromHeaders(
    socket.handshake.headers as Record<string, unknown>,
    socket.request?.socket?.remoteAddress || socket.handshake.address,
  );
}
