import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ContentCard from '../components/ContentCard';
import { getVideoList } from '../api/video';
import { Video } from '../api/types';
import { VIDEO_SOURCES } from '../api/config';

const SearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSource, setSelectedSource] = useState<keyof typeof VIDEO_SOURCES>('feifan');

  // 从URL参数初始化状态
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q') || '';
    const pageParam = params.get('page');
    const sourceParam = params.get('source') as keyof typeof VIDEO_SOURCES;
    
    if (pageParam) {
      setPage(parseInt(pageParam, 10));
    }
    
    if (sourceParam && sourceParam in VIDEO_SOURCES) {
      setSelectedSource(sourceParam);
    }
    
    setSearchTerm(query);
  }, [location.search]);

  // 处理搜索请求
  useEffect(() => {
    if (searchTerm) {
      fetchSearchResults(searchTerm, page);
    } else {
      setLoading(false);
    }
  }, [searchTerm, page, selectedSource]);

  const fetchSearchResults = async (query: string, currentPage: number) => {
    setLoading(true);
    try {
      const response = await getVideoList({
        ac: 'videolist',
        wd: query,
        pg: currentPage - 1,
        pagesize: 24,
      }, VIDEO_SOURCES[selectedSource].url);
      
      setSearchResults(response.list);
      setTotalPages(response.pagecount);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    navigate(`/search?q=${searchTerm}&page=${newPage}&source=${selectedSource}`);
  };

  const handleSourceChange = (source: keyof typeof VIDEO_SOURCES) => {
    setSelectedSource(source);
    setPage(1);
    navigate(`/search?q=${searchTerm}&page=1&source=${source}`);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            搜索结果: {searchTerm}
          </h1>
          
          {/* 数据源选择下拉菜单 */}
          <select
            value={selectedSource}
            onChange={(e) => handleSourceChange(e.target.value as keyof typeof VIDEO_SOURCES)}
            className="px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-sm"
          >
            {Object.entries(VIDEO_SOURCES).map(([key, source]) => (
              <option key={key} value={key}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {searchResults.map((item) => (
                <ContentCard
                  key={item.vod_id}
                  id={item.vod_id}
                  title={item.vod_name}
                  imageUrl={item.vod_pic}
                  rating={typeof item.vod_score === 'number' ? item.vod_score.toFixed(1) : undefined}
                  episodeCount={item.vod_play_url ? item.vod_play_url.split('#').length.toString() : undefined}
                  source={selectedSource}
                />
              ))}
            </div>
            
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                  >
                    上一页
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 rounded-md ${
                          page === pageNum ? 'bg-primary text-white' : 'bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">没有找到与 "{searchTerm}" 相关的内容</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SearchResultsPage;
