type ClientNetworkInfo = { location?: string };

const CACHE_KEY = 'fishTV:client-network-info';
const CACHE_TTL = 24 * 60 * 60 * 1000;
let lookup: Promise<ClientNetworkInfo> | null = null;

function normalize(value: unknown) {
  return String(value || '').trim().replace(/^(中国|中华人民共和国)\s*/u, '').split(/[\s/|]+/u)
    .filter(Boolean).slice(0, 2).map(item => item.replace(/(省|市|特别行政区|壮族自治区|回族自治区|维吾尔自治区)$/u, ''))
    .join(' ').slice(0, 32);
}

function cached() {
  try {
    const item = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as { location?: string; updatedAt?: number } | null;
    return item?.location && Date.now() - Number(item.updatedAt || 0) < CACHE_TTL ? { location: item.location } : null;
  } catch { return null; }
}

export function getClientNetworkInfo(): Promise<ClientNetworkInfo> {
  const saved = cached();
  if (saved) return Promise.resolve(saved);
  if (lookup) return lookup;
  lookup = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch('https://uapis.cn/api/v1/network/myip', {
        signal: controller.signal, headers: { Accept: 'application/json' }, cache: 'no-store',
      });
      if (!response.ok) return {};
      const data = await response.json() as Record<string, unknown>;
      const location = normalize(data.region);
      if (location) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ location, updatedAt: Date.now() })); } catch { /* ignore */ }
        return { location };
      }
    } catch { /* 地区查询失败不影响进房 */ }
    return {};
  })().finally(() => { lookup = null; });
  return lookup;
}
