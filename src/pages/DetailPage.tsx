import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import VideoDetail from '../components/VideoDetail';
import VideoDetailSkeleton from '../components/VideoDetailSkeleton';
import { findVideoByTitle, getVideoDetail } from '../api/video';
import { Video } from '../api/types';
import { VIDEO_SOURCES } from '../api/config';

const DetailPage = () => {
  const { id, source } = useParams<{ id: string; source?: string }>();
  const [videoData, setVideoData] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [selectedSource, setSelectedSource] = useState<keyof typeof VIDEO_SOURCES>(() => {
    if (source && source in VIDEO_SOURCES) {
      return source as keyof typeof VIDEO_SOURCES;
    }
    return 'feifan';
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getVideoDetail(id, VIDEO_SOURCES[selectedSource].url);
        if (!cancelled && response.list?.[0]) setVideoData(response.list[0]);
      } catch (error) {
        console.error('获取视频详情失败:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const handleSourceChange = async (nextSource: keyof typeof VIDEO_SOURCES) => {
    if (!videoData || nextSource === selectedSource || switchingSource) return;
    setSwitchingSource(true);
    setSourceError('');
    setLoading(true);
    try {
      const matched = await findVideoByTitle(videoData.vod_name, VIDEO_SOURCES[nextSource].url);
      if (!matched) throw new Error('当前渠道不可用');
      setVideoData({ ...matched, vod_pic: matched.vod_pic || videoData.vod_pic });
      setSelectedSource(nextSource);
    } catch (error) {
      console.error('切换视频源失败:', error);
      setSourceError('当前渠道不可用，已保持原片源');
    } finally {
      setLoading(false);
      setSwitchingSource(false);
    }
  };

  if (loading && !videoData) {
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
        sourceError={sourceError}
        sourceSwitching={switchingSource}
      />
    </Layout>
  );
};

export default DetailPage;
