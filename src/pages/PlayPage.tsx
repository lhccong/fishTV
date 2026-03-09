import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useHistory } from '../context/HistoryContext';
import Layout from '../components/Layout';
import VideoPlayer from '../components/VideoPlayer';
import VideoPlayerSkeleton from '../components/VideoPlayerSkeleton';
import { getVideoDetail, searchVideo } from '../api/video';
import { Video } from '../api/types';
import { VIDEO_SOURCES } from '../api/config';

// In a real application, this would come from API or route params
const sampleVideoData = {
  id: '52937',
  title: '斗破苍穹年番',
  coverUrl: 'https://ext.same-assets.com/1324623394/3930992340.jpeg',
  year: '2022',
  area: '内地',
  type: '国产动漫',
  description: '三年之约后，萧炎终于在迦南学院见到了薰儿，此后他广交挚友并成立磐门；为继续提升实力以三上云岚宗为父复仇，他以身犯险深入天焚炼气塔吞噬陨落心炎……',
  episodeCount: 141,
  currentEpisode: 1, // This would normally come from the URL params
  source: 2, // This would normally come from the URL params
};

// Related recommendations data
const relatedContent = [
  {
    id: 1,
    title: '长歌行动画版',
    imageUrl: 'https://ext.same-assets.com/1324623394/3930992340.jpeg',
    episodeCount: '08',
    rating: '0.0'
  },
  {
    id: 2,
    title: '海贼王',
    imageUrl: 'https://ext.same-assets.com/1324623394/2183140614.jpeg',
    episodeCount: '1142',
    rating: '9.5'
  },
  {
    id: 3,
    title: '高开A级队伍的我，和首领反派意外组CP',
    imageUrl: 'https://ext.same-assets.com/1324623394/3264221001.jpeg',
    episodeCount: '12',
    rating: '2.3'
  },
  {
    id: 4,
    title: '牧神记',
    imageUrl: 'https://ext.same-assets.com/1324623394/4133138594.jpeg',
    episodeCount: '25',
    rating: '3.5'
  },
  {
    id: 5,
    title: '剑道第一仙',
    imageUrl: 'https://ext.same-assets.com/1324623394/89086812.jpeg',
    episodeCount: '113',
    rating: '0.0'
  },
  {
    id: 6,
    title: '乡下大叔成为剑圣',
    imageUrl: 'https://ext.same-assets.com/1324623394/999127329.jpeg',
    episodeCount: '01',
    rating: '4.1'
  },
];

const PlayPage = () => {
  const { id, episode, source } = useParams<{ id: string; episode?: string; source?: string }>();
  const navigate = useNavigate();
  const { addToHistory, history, removeFromHistory } = useHistory();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<keyof typeof VIDEO_SOURCES>(() => {
    if (source && source in VIDEO_SOURCES) {
      return source as keyof typeof VIDEO_SOURCES;
    }
    const lastHistory = history.find(item => item.id === id);
    return (lastHistory?.source as keyof typeof VIDEO_SOURCES) || 'feifan';
  });
  const [currentEpisode, setCurrentEpisode] = useState(Number(episode || '1'));
  const [sourceStartIndex, setSourceStartIndex] = useState(0);
  const sourcesPerPage = 3; // 每页显示的数据源数量改为3个

  // 计算当前显示的数据源
  const visibleSources = Object.entries(VIDEO_SOURCES).slice(sourceStartIndex, sourceStartIndex + sourcesPerPage);
  const canShowPrev = sourceStartIndex > 0;
  const canShowNext = sourceStartIndex + sourcesPerPage < Object.keys(VIDEO_SOURCES).length;

  const handlePrevSources = () => {
    setSourceStartIndex(Math.max(0, sourceStartIndex - sourcesPerPage));
  };

  const handleNextSources = () => {
    setSourceStartIndex(Math.min(
      Object.keys(VIDEO_SOURCES).length - sourcesPerPage,
      sourceStartIndex + sourcesPerPage
    ));
  };

  // 获取视频详情的函数
  const fetchVideo = async (source: keyof typeof VIDEO_SOURCES) => {
    try {
      // 如果是初始加载，使用 ID 获取详情
      if (id) {
        const response = await getVideoDetail(id, VIDEO_SOURCES[source].url);
        if (response.list && response.list.length > 0) {
          const videoData = response.list[0];
          setVideo(videoData);
          addToHistory({
            id: videoData.vod_id.toString(),
            title: videoData.vod_name,
            imageUrl: videoData.vod_pic,
            episode: episode || '1',
            lastWatched: new Date(),
            source: source
          });
        }
      } else if (video?.vod_name) {
        // 如果是切换数据源，使用标题搜索
        const response = await searchVideo(video.vod_name, VIDEO_SOURCES[source].url);
        if (response.list && response.list.length > 0) {
          const videoData = response.list[0];
          setVideo(videoData);
          addToHistory({
            id: videoData.vod_id.toString(),
            title: videoData.vod_name,
            imageUrl: videoData.vod_pic,
            episode: episode || '1',
            lastWatched: new Date(),
            source: source
          });
        }
      }
    } catch (error) {
      console.error('获取视频详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和 ID 变化时获取视频详情
  useEffect(() => {
    if (id) {
      fetchVideo(selectedSource);
    }
  }, [id, episode]);

  // 处理视频源切换
  const handleSourceChange = async (source: keyof typeof VIDEO_SOURCES) => {
    setSelectedSource(source);
    setLoading(true);
    console.log(video?.vod_name)
    try {
      // 使用当前视频标题搜索新数据源中的视频，只取空格前的部分
      if (video?.vod_name) {
        const searchKeyword = video.vod_name.split(' ')[0].split('　')[0]; // 处理普通空格和全角空格
        const response = await searchVideo(searchKeyword, VIDEO_SOURCES[source].url);
        if (response.list && response.list.length > 0) {
          const newVideo = response.list[0];
          setVideo(newVideo);

          // 更新 URL 以包含新的数据源
          navigate(`/play/${newVideo.vod_id}/${currentEpisode}/${source}`, { replace: true });
          addToHistory({
            id: newVideo.vod_id.toString(),
            title: newVideo.vod_name,
            imageUrl: newVideo.vod_pic,
            episode: currentEpisode.toString(),
            lastWatched: new Date(),
            source: source
          });
        }
      }
    } catch (error) {
      console.error('切换数据源失败:', error);
      // 如果切换失败，恢复原来的数据源
      setSelectedSource(selectedSource);
    } finally {
      setLoading(false);
    }
  };

  const getPlayUrl = () => {
    if (!video?.vod_play_url) return '';
    
    const episodes = video.vod_play_url.split('#');
    const currentEpisodeData = episodes[currentEpisode - 1];
    if (!currentEpisodeData) return '';
    
    const parts = currentEpisodeData.split('$');
    return parts.length > 1 ? parts[1] : '';
  };

  const handleEpisodeChange = (ep: number) => {
    setCurrentEpisode(ep);
    // 更新 URL 时保持当前的数据源
    navigate(`/play/${id}/${ep}/${selectedSource}`);
    
    // 移除旧的历史记录
    removeFromHistory(id || '');
    
    // 添加新的历史记录
    if (video) {
      addToHistory({
        id: video.vod_id.toString(),
        title: video.vod_name,
        imageUrl: video.vod_pic,
        episode: ep.toString(),
        lastWatched: new Date(),
        source: selectedSource
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <VideoPlayerSkeleton />
      </Layout>
    );
  }

  if (!video) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="bg-red-50 p-8 rounded-lg max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-red-700 mb-2">出错了</h3>
            <p className="text-gray-600">未找到视频信息，请检查视频ID是否正确</p>
          </div>
        </div>
      </Layout>
    );
  }

  const totalEpisodes = video.vod_play_url ? video.vod_play_url.split('#').length : 0;
  const currentVideoUrl = getPlayUrl();

  return (
    <Layout>
      <div className="bg-[#f3f8f8] pt-4">
        {/* Video title section */}
        <div className="mb-4">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">
              <Link to={`/detail/${id}`} className="hover:text-primary">
                {video.vod_name}
              </Link>
            </h1>
            <div className="flex ml-4 space-x-2">
              <Link to="/list/3.html" className="px-2 py-1 bg-gray-100 text-sm text-gray-700 rounded hover:bg-gray-200">
                {video.type_name}
              </Link>
              <span className="px-2 py-1 bg-gray-100 text-sm text-gray-700 rounded">
                {video.vod_year}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-sm text-gray-700 rounded">
                {video.vod_area}
              </span>
            </div>
          </div>
        </div>

        {/* Video player section */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 bg-black rounded-lg overflow-hidden">
            <VideoPlayer
              id={id || ''}
              title={video.vod_name}
              source={selectedSource}
              episode={currentEpisode}
              totalEpisodes={totalEpisodes}
              videoUrl={currentVideoUrl}
            />
          </div>

          {/* Episode selection section */}
          <div className="lg:w-80 bg-white rounded-lg p-4">
            <div className="flex flex-col space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">选集播放</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevSources}
                  disabled={!canShowPrev}
                  className={`p-1.5 rounded-lg transition-all ${
                    canShowPrev
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                <div className="flex-1 flex gap-1.5">
                  {visibleSources.map(([key, source]) => (
                    <button
                      key={key}
                      className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap overflow-hidden ${
                        selectedSource === key
                          ? 'bg-primary text-white shadow-lg'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                      }`}
                      onClick={() => handleSourceChange(key as keyof typeof VIDEO_SOURCES)}
                    >
                      <span className="block text-center truncate">{source.name}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleNextSources}
                  disabled={!canShowNext}
                  className={`p-1.5 rounded-lg transition-all ${
                    canShowNext
                      ? 'text-gray-600 hover:bg-gray-100'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="border-t border-gray-200 my-2"></div>
            </div>

            {/* Episodes grid */}
            <div className="relative mt-6">
              <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
                {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
                  // 解析播放地址，获取集数名称
                  const episodeNames = video.vod_play_url.split('#').map(ep => {
                    const parts = ep.split('$');
                    return parts[0] || '';
                  });
                  
                  const episodeName = episodeNames[ep - 1] || `第${ep.toString().padStart(2, '0')}集`;
                  
                  return (
                    <div key={ep} className="relative group">
                      <button
                        onClick={() => handleEpisodeChange(ep)}
                        className={`w-full py-2 text-center border rounded hover:border-primary transition-colors ${
                          ep === currentEpisode ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="block truncate px-1">
                          {episodeName}
                        </span>
                      </button>
                      <div className="absolute left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none
                        top-full mt-2 group-hover:block hidden">
                        {episodeName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Related recommendations */}
        {/*<div className="mb-6">*/}
        {/*  <h2 className="text-xl font-bold mb-4">相关推荐</h2>*/}

        {/*  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">*/}
        {/*    {relatedContent.map((item) => (*/}
        {/*      <Link to={`/detail/${item.id}`} key={item.id} className="block">*/}
        {/*        <div className="content-card relative bg-white rounded-md overflow-hidden shadow-sm">*/}
        {/*          <div className="relative pb-[140%]">*/}
        {/*            <img*/}
        {/*              src={item.imageUrl}*/}
        {/*              alt={item.title}*/}
        {/*              className="absolute inset-0 w-full h-full object-cover"*/}
        {/*            />*/}

        {/*            /!* Rating badge *!/*/}
        {/*            <div className="absolute top-1 left-1 rating-badge">*/}
        {/*              {item.rating}*/}
        {/*            </div>*/}

        {/*            /!* Episode count *!/*/}
        {/*            <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">*/}
        {/*              更新至{item.episodeCount}集*/}
        {/*            </div>*/}

        {/*            /!* Play button overlay *!/*/}
        {/*            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-40">*/}
        {/*              <div className="play-icon p-2 rounded-full bg-white bg-opacity-80">*/}
        {/*                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">*/}
        {/*                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />*/}
        {/*                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />*/}
        {/*                </svg>*/}
        {/*              </div>*/}
        {/*            </div>*/}
        {/*          </div>*/}

        {/*          <div className="p-2">*/}
        {/*            <h3 className="text-sm font-medium line-clamp-1" title={item.title}>*/}
        {/*              {item.title}*/}
        {/*            </h3>*/}
        {/*          </div>*/}
        {/*        </div>*/}
        {/*      </Link>*/}
        {/*    ))}*/}
        {/*  </div>*/}
        {/*</div>*/}
      </div>
    </Layout>
  );
};

export default PlayPage;
