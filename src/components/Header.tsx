import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiSearch, HiClock, HiX, HiTrash } from 'react-icons/hi';
import { useHistory } from '../context/HistoryContext';
import { useSearchHistory } from '../context/SearchHistoryContext';
import ThemeToggle from './ThemeToggle';
import AccountMenu from './AccountMenu';
import TopNavigation from './TopNavigation';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showWatchHistory, setShowWatchHistory] = useState(false);
  const navigate = useNavigate();
  const { history, removeFromHistory } = useHistory();
  const { history: searchHistory, addToHistory, removeFromHistory: removeFromSearchHistory, clearHistory } = useSearchHistory();
  const timeoutRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const watchHistoryRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim());
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setShowHistory(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setShowHistory(false);
    }, 200);
  };

  const handleWatchHistoryMouseEnter = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setShowWatchHistory(true);
  };

  const handleWatchHistoryMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setShowWatchHistory(false);
    }, 200);
  };

  const handleHistoryItemClick = (query: string) => {
    setSearchQuery(query);
    addToHistory(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setShowHistory(false);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <header className="app-header sticky top-0 z-30 border-b border-white/5 bg-black/20 backdrop-blur-xl">
      <div className="header-grid">
          <TopNavigation />

          {/* 搜索框 */}
          <form onSubmit={handleSearch} className="header-search" role="search">
            <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <input
                type="text"
                aria-label="搜索影片"
                placeholder="搜索电影、电视剧、动漫..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="header-search-input"
              />
              <button
                type="submit"
                aria-label="搜索"
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <HiSearch className="w-5 h-5" />
              </button>
              
              {/* 搜索记录下拉菜单 */}
              {showHistory && searchHistory.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50"
                >
                  <div className="p-2 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <HiClock className="w-4 h-4" />
                      <span>搜索历史</span>
                    </div>
                    <button
                      type="button"
                      aria-label="清空搜索历史"
                      onClick={() => {
                        if (window.confirm('确定要清空所有搜索历史吗？')) {
                          clearHistory();
                        }
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="py-1">
                    {searchHistory.map((item, index) => (
                      <li
                        key={index}
                        className="group flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <div
                          className="flex-1 flex items-center gap-2"
                          onClick={() => handleHistoryItemClick(item.query)}
                        >
                          <HiSearch className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{item.query}</span>
                        </div>
                        <button
                          type="button"
                          aria-label="删除搜索记录"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromSearchHistory(index);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </form>

          {/* 导航工具按钮 */}
          <div className="header-user-tools">
            <Link to="/rooms" className="shrink-0 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/20">房间</Link>
            {/* 历史记录按钮 */}
            <div className="relative" onMouseEnter={handleWatchHistoryMouseEnter} onMouseLeave={handleWatchHistoryMouseLeave}>
              <Link
                to="/history"
                className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-900"
              >
                <HiClock className="w-5 h-5" />
                <span className="hidden sm:inline">历史</span>
              </Link>

              {/* 观看历史下拉菜单 */}
              {showWatchHistory && history.length > 0 && (
                <div
                  ref={watchHistoryRef}
                  className="header-history absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                >
                  <div className="p-2">
                    {history.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-md group">
                        <Link
                          to={`/play/${item.id}/${item.episode || '1'}/${item.source || 'feifan'}`}
                          className="flex-1 flex items-center space-x-3 min-w-0"
                          onClick={() => setShowWatchHistory(false)}
                        >
                          <div className="w-16 h-9 rounded overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.episode && (
                              <p className="text-xs text-gray-500">看到第 {item.episode} 集</p>
                            )}
                          </div>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />
            <AccountMenu />
          </div>
      </div>
    </header>
  );
};

export default Header;
