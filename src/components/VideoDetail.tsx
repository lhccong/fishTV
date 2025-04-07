import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface VideoDetailProps {
  id: string;
  title: string;
  coverUrl: string;
  year: string;
  area: string;
  type: string;
  description: string;
  episodeCount: number;
  currentEpisode?: number;
  // Add more props as needed
}

const VideoDetail = ({
  id,
  title,
  coverUrl,
  year,
  area,
  type,
  description,
  episodeCount,
  currentEpisode = 1,
}: VideoDetailProps) => {
  const [selectedSource, setSelectedSource] = useState<number>(1); // Default to first source

  // Generate episode numbers for the pagination
  const episodes = Array.from({ length: episodeCount }, (_, i) => i + 1);

  return (
    <div className="bg-[#f3f8f8] pt-6">
      {/* Video header section */}
      <div className="bg-white rounded-lg overflow-hidden mb-6">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4 text-gray-800 border-l-4 border-primary pl-3">
            {title}
          </h1>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Cover image */}
            <div className="w-full md:w-1/4">
              <div className="relative pb-[140%]">
                <img
                  src={coverUrl}
                  alt={title}
                  className="absolute inset-0 w-full h-full object-cover rounded-md"
                />
              </div>
            </div>

            {/* Right: Video details */}
            <div className="w-full md:w-3/4">
              <div className="mb-4">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded mr-2">{year}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded mr-2">{area}</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">{type}</span>
              </div>

              <p className="text-gray-700 mb-6">{description}</p>

              <div className="flex gap-3 items-center">
                <Link
                  to={`/play/${id}-${selectedSource}-${currentEpisode}`}
                  className="flex items-center px-6 py-2 bg-primary text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  立即播放
                </Link>

                <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  收藏
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episode selection */}
      <div className="bg-white rounded-lg p-6 mb-6">
        <div className="mb-4 border-b border-gray-200 pb-2">
          <h2 className="text-lg font-semibold">选集播放</h2>

          {/* Source tabs */}
          <div className="flex gap-4 mt-4">
            <button
              className={`px-4 py-1 rounded-full ${selectedSource === 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setSelectedSource(1)}
            >
              非凡云
            </button>
            <button
              className={`px-4 py-1 rounded-full ${selectedSource === 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => setSelectedSource(2)}
            >
              优质云
            </button>
          </div>
        </div>

        {/* Episodes grid */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {episodes.map((episode) => (
            <Link
              key={episode}
              to={`/play/${id}-${selectedSource}-${episode}`}
              className={`py-2 px-1 text-center border rounded hover:border-primary transition-colors ${
                episode === currentEpisode ? 'border-primary text-primary' : 'border-gray-200 text-gray-700'
              }`}
            >
              第{episode.toString().padStart(2, '0')}集
            </Link>
          ))}
        </div>
      </div>

      {/* Related recommendations */}
      <div className="bg-white rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 border-b border-gray-200 pb-2">相关推荐</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* We would map through related items here */}
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="content-card relative bg-white rounded-md overflow-hidden shadow-sm">
              <div className="relative pb-[140%]">
                <img
                  src={`https://ext.same-assets.com/2490417499/${3930992340 - item * 500000}.jpeg`}
                  alt="Related content"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Rating badge */}
                <div className="absolute top-1 left-1 rating-badge">
                  {(Math.random() * 2 + 7).toFixed(1)}
                </div>

                {/* Episode count */}
                <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
                  更新至{Math.floor(Math.random() * 20 + 1)}集
                </div>

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-40">
                  <div className="play-icon p-2 rounded-full bg-white bg-opacity-80">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="p-2">
                <h3 className="text-sm font-medium line-clamp-1">
                  相关推荐视频 {item}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoDetail;
