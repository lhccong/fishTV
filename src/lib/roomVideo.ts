import type { Video } from '../api/types';

export type VideoEpisode = { name: string; url: string };

function decodeEpisodeUrl(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function videoEpisodes(video: Video, directOnly = false): VideoEpisode[] {
  const lines = video.vod_play_url?.split('$$$') || [];
  let fallback: VideoEpisode[] = [];
  for (const line of lines) {
    const episodes = line.split('#').map((entry, index) => {
      const separator = entry.indexOf('$');
      return {
        name: (separator >= 0 ? entry.slice(0, separator) : `第 ${index + 1} 集`).trim() || `第 ${index + 1} 集`,
        url: decodeEpisodeUrl((separator >= 0 ? entry.slice(separator + 1) : entry).trim()),
      };
    });
    if (!fallback.length) fallback = episodes;
    if (episodes.some(episode => isRoomMedia(episode.url))) return episodes;
  }
  return directOnly ? [] : fallback;
}

export function roomEpisodes(video: Video): VideoEpisode[] {
  return videoEpisodes(video, true);
}

export function allEpisodes(video: Video): VideoEpisode[] {
  return videoEpisodes(video, false);
}

export function isRoomMedia(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      && /\.(m3u8|mp4|webm|ogg)(?:$|\/)/i.test(url.pathname);
  } catch { return false; }
}
