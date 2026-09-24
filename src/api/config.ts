export const API_CONFIG = {
  baseURL: '/ikun/api.php',
  timeout: 10000,
};

export type VideoSource = {
  name: string;
  url: string;
  enabled?: boolean;
  builtIn?: boolean;
  proxyUrl?: string;
  createdAt?: number;
  updatedAt?: number;
};

export const VIDEO_SOURCES: Record<string, VideoSource> = {
  feifan: {
    name: '非凡云',
    url: '/video-source/feifan'
  },
  modu: {
    name: '魔都云',
    url: '/video-source/modu'
  },
  youzhi: {
    name: '优质云',
    url: '/video-source/youzhi'
  },
  subocaiji: {
    name: '速播云',
    url: '/video-source/subocaiji'
  },
};

export function setVideoSources(sources: Array<{ id: string; name: string; proxyUrl: string; enabled: boolean }>) {
  const next: Record<string, VideoSource> = {};
  for (const source of sources) {
    if (source.enabled === false) continue;
    next[source.id] = { ...source, url: source.proxyUrl || `/video-source/${source.id}` };
  }
  if (Object.keys(next).length) Object.assign(VIDEO_SOURCES, next);
  for (const key of Object.keys(VIDEO_SOURCES)) {
    if (!next[key]) delete VIDEO_SOURCES[key];
  }
}

export const setBaseURL = (url: string) => {
  API_CONFIG.baseURL = url;
};
