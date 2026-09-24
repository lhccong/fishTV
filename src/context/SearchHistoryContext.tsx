import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCurrentUser } from './AccessGate';

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

interface SearchHistoryContextType {
  history: SearchHistoryItem[];
  addToHistory: (query: string) => void;
  removeFromHistory: (index: number) => void;
  clearHistory: () => void;
}

const SearchHistoryContext = createContext<SearchHistoryContextType | undefined>(undefined);

export const SearchHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useCurrentUser();
  const storageKey = `fishTV:searchHistory:${user?.id || 'admin'}`;
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(history));
  }, [history, storageKey]);

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    
    setHistory(prev => {
      // 移除重复的搜索记录
      const filtered = prev.filter(item => item.query !== query);
      // 添加新的搜索记录到开头
      return [{ query, timestamp: Date.now() }, ...filtered];
    });
  };

  const removeFromHistory = (index: number) => {
    setHistory(prev => prev.filter((_, i) => i !== index));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <SearchHistoryContext.Provider value={{ history, addToHistory, removeFromHistory, clearHistory }}>
      {children}
    </SearchHistoryContext.Provider>
  );
};

export const useSearchHistory = () => {
  const context = useContext(SearchHistoryContext);
  if (context === undefined) {
    throw new Error('useSearchHistory must be used within a SearchHistoryProvider');
  }
  return context;
};
