import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import VideoDetail from '../components/VideoDetail';
import VideoDetailSkeleton from '../components/VideoDetailSkeleton';
import { getVideoDetail, searchVideo } from '../api/video';
import { Video } from '../api/types';
import { VIDEO_SOURCES } from '../api/config';

const DetailPage = () => {
  const { id, source } = useParams<{ id: string; source?: string }>();
  const [videoData, setVideoData] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<keyof typeof VIDEO_SOURCES>(() => {
    if (source && source in VIDEO_SOURCES) {
      return source as keyof typeof VIDEO_SOURCES;
    }
    return 'feifan';
  });

  const fetchVideoData = async (source: keyof typeof VIDEO_SOURCES) => {
    setLoading(true);
    try {
      // 如果是初始加载，使用 ID 获取详情
      if (id && !videoData) {
        const response = await getVideoDetail(id, VIDEO_SOURCES[source].url);
        if (response.list && response.list.length > 0) {
          setVideoData(response.list[0]);
        }
      } else if (videoData?.vod_name) {
        // 如果是切换数据源，使用标题搜索
        const searchKeyword = videoData.vod_name.split(' ')[0].split('　')[0]; // 处理普通空格和全角空格
        const response = await searchVideo(searchKeyword, VIDEO_SOURCES[source].url);
        if (response.list && response.list.length > 0) {
          setVideoData(response.list[0]);
        }
      }
    } catch (error) {
      console.error('获取视频详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchVideoData(selectedSource);
    }
  }, [id, selectedSource]);

  const handleSourceChange = (source: keyof typeof VIDEO_SOURCES) => {
    setSelectedSource(source);
  };

  if (loading) {
    return (
      <Layout>
        <VideoDetailSkeleton />
      </Layout>
    );
  }

  if (!videoData) {
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
            <p className="text-gray-600">未找到视频详情，请检查视频ID是否正确</p>
          </div>
        </div>
      </Layout>
    );
  }

  // 解析播放地址，获取集数和名称
  const parsePlayUrl = (playUrl: string) => {
    if (!playUrl) return { count: 0, names: [] };
    
    const episodes = playUrl.split('#');
    const names = episodes.map(ep => {
      const parts = ep.split('$');
      return parts[0] || '';
    });
    
    return {
      count: episodes.length,
      names
    };
  };

  const { count, names } = parsePlayUrl(videoData.vod_play_url);

  return (
    <Layout>
      <VideoDetail
        id={videoData.vod_id.toString()}
        title={videoData.vod_name}
        coverUrl={videoData.vod_pic}
        year={videoData.vod_year}
        area={videoData.vod_area}
        type={videoData.type_name}
        description={videoData.vod_content}
        episodeCount={count}
        episodeNames={names}
        currentSource={selectedSource}
        onSourceChange={handleSourceChange}
      />
    </Layout>
  );
};

export default DetailPage;
