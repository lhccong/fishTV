import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import Banner from './components/Banner';
import ContentSection from './components/ContentSection';
import DetailPage from './pages/DetailPage';
import PlayPage from './pages/PlayPage';
import SearchResultsPage from './pages/SearchResultsPage';
import HistoryPage from './pages/HistoryPage';
import { HistoryProvider } from './context/HistoryContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import { bannerData, trendingContent, tvContent, animeContent } from './data/sampleData';
import { getVideoList } from './api/video';
import { Video } from './api/types';
import TypeListPage from "./pages/TypeListPage.tsx";

// 缓存键名
const CACHE_KEYS = {
  MOVIES: 'movies_cache',
  TV: 'tv_cache',
  ANIME: 'anime_cache',
  VARIETY: 'variety_cache'
};

// 缓存过期时间（1小时）
const CACHE_EXPIRY = 60 * 60 * 1000;

// 缓存工具函数
const cache = {
  get: (key: string) => {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  },
  
  set: (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }
};

// Homepage Component
const HomePage = () => {
  const [movieContent, setMovieContent] = useState<Video[]>([]);
  const [tvContent, setTvContent] = useState<Video[]>([]);
  const [animeContent, setAnimeContent] = useState<Video[]>([]);
  const [varietyContent, setVarietyContent] = useState<Video[]>([]);
  const [movieLoading, setMovieLoading] = useState(true);
  const [tvLoading, setTvLoading] = useState(true);
  const [animeLoading, setAnimeLoading] = useState(true);
  const [varietyLoading, setVarietyLoading] = useState(true);

  // 获取数据的通用函数
  const fetchData = async (
    type: number,
    setData: React.Dispatch<React.SetStateAction<Video[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    cacheKey: string
  ) => {
    // 先检查缓存
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    try {
      const response = await getVideoList({ t: type });
      setData(response.list);
      // 设置缓存
      cache.set(cacheKey, response.list);
    } catch (error) {
      console.error(`获取数据失败:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(6, setMovieContent, setMovieLoading, CACHE_KEYS.MOVIES);
    fetchData(13, setTvContent, setTvLoading, CACHE_KEYS.TV);
    fetchData(60, setAnimeContent, setAnimeLoading, CACHE_KEYS.ANIME);
    fetchData(38, setVarietyContent, setVarietyLoading, CACHE_KEYS.VARIETY);
  }, []);

  // 使用useMemo缓存组件渲染
  const contentSections = useMemo(() => [
    {
      title: "电影",
      items: movieContent,
      seeMoreLink: "/movies",
      loading: movieLoading
    },
    {
      title: "综艺",
      items: varietyContent,
      seeMoreLink: "/variety",
      loading: varietyLoading
    },
    {
      title: "电视剧",
      items: tvContent,
      seeMoreLink: "/tv",
      loading: tvLoading
    },
    {
      title: "动漫",
      items: animeContent,
      seeMoreLink: "/anime",
      loading: animeLoading
    }
  ], [movieContent, varietyContent, tvContent, animeContent, movieLoading, varietyLoading, tvLoading, animeLoading]);

  return (
    <Layout>
      <Banner
        title={bannerData.title}
        imageUrl={bannerData.imageUrl}
        description={bannerData.description}
      />

      {contentSections.map((section, index) => (
        <ContentSection
          key={index}
          title={section.title}
          items={section.items}
          seeMoreLink={section.seeMoreLink}
          loading={section.loading}
        />
      ))}
    </Layout>
  );
};

function App() {
  return (
    <ThemeProvider>
      <HistoryProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/detail/:id/:source?" element={<DetailPage />} />
            <Route path="/play/:id/:episode?/:source?" element={<PlayPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/movies" element={<TypeListPage type="movies" />} />
            <Route path="/tv" element={<TypeListPage type="tv" />} />
            <Route path="/anime" element={<TypeListPage type="anime" />} />
            <Route path="/variety" element={<TypeListPage type="variety" />} />
            <Route path="/short" element={<TypeListPage type="short" />} />
          </Routes>
          <ThemeToggle />
        </Router>
      </HistoryProvider>
    </ThemeProvider>
  );
}

export default App;
