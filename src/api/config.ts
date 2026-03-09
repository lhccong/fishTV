export const API_CONFIG = {
  baseURL: '/ikun/api.php',
  timeout: 10000,
};

export const VIDEO_SOURCES = {
  feifan: {
    name: '非凡云',
    url: '/ikun/api.php'
  },
  modu: {
    name: '魔都云',
    url: '/modu/api.php'
  },
  youzhi: {
    name: '优质云',
    url: '/youzhi/inc/apijson.php'
  },
  subocaiji: {
    name: '速播云',
    url: '/subocaiji/api.php'
  },

};

export const setBaseURL = (url: string) => {
  API_CONFIG.baseURL = url;
}; 