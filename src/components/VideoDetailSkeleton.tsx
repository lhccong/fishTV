import React from 'react';

const VideoDetailSkeleton = () => {
  return (
    <div className="loading-skeleton bg-[var(--app-bg)] pt-6" role="status" aria-label="正在加载影片详情">
      {/* Video header section skeleton */}
      <div className="bg-[var(--app-surface)] rounded-lg overflow-hidden mb-6">
        <div className="p-6">
          <div className="h-8 w-3/4 skeleton-fill rounded mb-4"></div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Cover image skeleton */}
            <div className="w-full md:w-1/4">
              <div className="relative pb-[140%] skeleton-fill rounded-md"></div>
            </div>

            {/* Right: Video details skeleton */}
            <div className="w-full md:w-3/4">
              <div className="mb-4 flex gap-2">
                <div className="h-6 w-16 skeleton-fill rounded"></div>
                <div className="h-6 w-16 skeleton-fill rounded"></div>
                <div className="h-6 w-16 skeleton-fill rounded"></div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="h-4 w-full skeleton-fill rounded"></div>
                <div className="h-4 w-5/6 skeleton-fill rounded"></div>
                <div className="h-4 w-4/6 skeleton-fill rounded"></div>
              </div>

              <div className="flex gap-3">
                <div className="h-10 w-32 skeleton-fill rounded"></div>
                <div className="h-10 w-24 skeleton-fill rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode selection skeleton */}
      <div className="bg-[var(--app-surface)] rounded-lg p-6 mb-6">
        <div className="mb-4">
          <div className="h-6 w-24 skeleton-fill rounded"></div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-10 skeleton-fill rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoDetailSkeleton;
