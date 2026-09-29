import request from './request';
import { Video, VideoListParams } from './types';

export const getVideoList = async (params: VideoListParams = {}, baseURL?: string) => {
  // 如果参数中包含wd（搜索关键词），则不带上t=6参数
  const defaultParams = params.wd ? {
    ac: 'videolist',
    pg: 1,
    pagesize: 12,
  } : {
    ac: 'videolist',
    pg: 1,
    pagesize: 12,
    t: 6,
  };

  return request<Video>('/provide/vod/', {
    ...defaultParams,
    ...params,
  }, baseURL);
};

export const getVideoDetail = async (id: string, baseURL?: string) => {
  return request<Video>('/provide/vod/', {
    ac: 'detail',
    ids: id,
  }, baseURL);
};

export const searchVideo = async (title: string, baseURL?: string) => {
  return request<Video>('/provide/vod/', {
    ac: 'videolist',
    wd: title,
  }, baseURL);
};

const normalizeTitle = (title: string) => title
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\d{4}/g, '')
  .replace(/[^\p{L}\p{N}\u3400-\u9fff]+/gu, '');

/** 跨片源按片名查找，兼容年份、空格和标点差异，但不盲取搜索结果第一条。 */
export const findVideoByTitle = async (title: string, baseURL?: string) => {
  const queries = [...new Set([
    title.trim(),
    title.replace(/[（(]?\d{4}[）)]?/g, '').trim(),
  ].filter(Boolean))];
  for (const query of queries) {
    const response = await searchVideo(query, baseURL);
    const candidates = response.list || [];
    const target = normalizeTitle(title);
    const exact = candidates.find(item => normalizeTitle(item.vod_name) === target);
    if (exact) return exact;
    const partial = candidates.find(item => {
      const candidate = normalizeTitle(item.vod_name);
      return candidate.length >= 2 && (candidate.includes(target) || target.includes(candidate));
    });
    if (partial) return partial;
  }

  return null;
};
