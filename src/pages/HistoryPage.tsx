import React from 'react';
import { useHistory } from '../context/HistoryContext';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { VIDEO_SOURCES } from '../api/config';

const HistoryPage: React.FC = () => {
  const { history, removeFromHistory, clearHistory } = useHistory();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">观看历史</h1>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('确定要清空所有观看历史吗？此操作不可恢复。')) {
                  clearHistory();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空历史记录
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无观看历史</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {history.map((item) => (
              <div key={item.id} className="relative group">
                <Link to={`/play/${item.id}/${item.episode || '1'}/${item.source || 'feifan'}`}>
                  <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2">
                    <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                    <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
                      {item.episode && (
                        <span>看到第 {item.episode} 集</span>
                      )}
                      {item.source && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded">
                          {VIDEO_SOURCES[item.source as keyof typeof VIDEO_SOURCES]?.name || '未知来源'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.lastWatched).toLocaleString()}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => {
                    if (window.confirm('确定要删除这条观看记录吗？')) {
                      removeFromHistory(item.id);
                    }
                  }}
                  className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-70"
                  title="删除记录"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HistoryPage; 