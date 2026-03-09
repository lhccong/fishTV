export const API_CONFIG = {
  baseURL: 'https://tv.yucoder.cn/ikun/api.php',
  timeout: 10000,
};

export const VIDEO_SOURCES = {
  feifan: {
    name: '非凡云',
    url: 'https://tv.yucoder.cn/ikun/api.php'
  },
  modu: {
    name: '魔都云',
    url: 'https://tv.yucoder.cn/modu/api.php'
  },
  youzhi: {
    name: '优质云',
    url: 'https://tv.yucoder.cn/youzhi/inc/apijson.php'
  },
  subocaiji: {
    name: '速播云',
    url: 'https://tv.yucoder.cn/subocaiji/api.php'
  },

};

export const setBaseURL = (url: string) => {
  API_CONFIG.baseURL = url;
}; 