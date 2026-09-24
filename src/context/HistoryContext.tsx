import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCurrentUser } from './AccessGate';

interface HistoryItem {
  id: string;
  title: string;
  imageUrl: string;
  lastWatched: Date;
  episode?: string;
  source?: string;
}

interface HistoryContextType {
  history: HistoryItem[];
  addToHistory: (item: HistoryItem) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const HistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useCurrentUser();
  const storageKey = `fishTV:watchHistory:${user?.id || 'admin'}`;
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(history));
  }, [history, storageKey]);

  const addToHistory = (item: HistoryItem) => {
    setHistory(prev => {
      const existingIndex = prev.findIndex(h => h.id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const [existingItem] = updated.splice(existingIndex, 1);
        return [{ ...existingItem, lastWatched: new Date() }, ...updated];
      }
      return [{ ...item, lastWatched: new Date() }, ...prev];
    });
  };

  const removeFromHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <HistoryContext.Provider value={{ history, addToHistory, removeFromHistory, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};
