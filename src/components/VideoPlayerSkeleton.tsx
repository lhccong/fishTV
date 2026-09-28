import React from 'react';

const VideoPlayerSkeleton = () => {
  return (
    <div className="loading-skeleton bg-[var(--app-bg)] pt-4" role="status" aria-label="正在加载播放器">
      {/* Video title section skeleton */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-6 w-48 skeleton-fill rounded"></div>
          <div className="flex space-x-2">
            <div className="h-6 w-16 skeleton-fill rounded"></div>
            <div className="h-6 w-16 skeleton-fill rounded"></div>
            <div className="h-6 w-16 skeleton-fill rounded"></div>
          </div>
        </div>
      </div>

      {/* Video player section skeleton */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Video player skeleton */}
        <div className="flex-1 bg-black rounded-lg overflow-hidden">
          <div className="w-full aspect-video skeleton-fill" aria-hidden="true" />
        </div>

        {/* Episode selection skeleton */}
        <div className="lg:w-80 bg-[var(--app-surface)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-24 skeleton-fill rounded"></div>
            <div className="flex space-x-3">
              <div className="h-8 w-16 skeleton-fill rounded-full"></div>
            </div>
          </div>

          {/* Episodes grid skeleton */}
          <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-10 skeleton-fill rounded"></div>
            ))}
          </div>
        </div>
      </div>

      {/* Related recommendations skeleton */}
      <div className="mb-6">
        <div className="h-6 w-24 skeleton-fill rounded mb-4"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="content-card relative bg-[var(--app-surface)] rounded-md overflow-hidden shadow-sm">
              <div className="relative pb-[140%] skeleton-fill"></div>
              <div className="p-2">
                <div className="h-4 w-3/4 skeleton-fill rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerSkeleton;
