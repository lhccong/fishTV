import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] skeleton-fill rounded-lg mb-2"></div>
      <div className="h-4 skeleton-fill rounded w-3/4 mb-2"></div>
      <div className="h-4 skeleton-fill rounded w-1/2"></div>
    </div>
  );
};

export default SkeletonCard;
