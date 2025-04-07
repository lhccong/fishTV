import React from 'react';

interface BannerProps {
  title: string;
  imageUrl: string;
  description?: string;
}

const Banner = ({ title, imageUrl, description }: BannerProps) => {
  return (
    <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden mb-8">
      <img
        src={imageUrl}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover bg-white"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
        <div className="absolute bottom-0 left-0 p-6">
          <h2 className="text-white text-xl md:text-2xl font-bold mb-2">{title}</h2>
          {description && (
            <p className="text-white text-sm md:text-base opacity-80 line-clamp-2">{description}</p>
          )}

          {/* <button className="mt-4 px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            立即播放
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default Banner;
