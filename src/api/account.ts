export class AccountError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function accountRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new AccountError(data.error || '服务暂不可用', response.status);
  return data as T;
}

export function jsonBody(body: unknown, method = 'POST'): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function clearUserCache() {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (
      key.startsWith('fishTV:watchHistory:')
      || key.startsWith('fishTV:searchHistory:')
      || key === 'watchHistory'
      || key === 'searchHistory'
      || key === 'avatar_url'
      || key === 'sjb_nickname'
    ) {
      localStorage.removeItem(key);
    }
  }
  sessionStorage.clear();
}
