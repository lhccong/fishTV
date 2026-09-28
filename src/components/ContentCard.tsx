import React from 'react';
import { Link } from 'react-router-dom';
import { VIDEO_SOURCES } from '../api/config';

interface ContentCardProps {
  id: number;
  title: string;
  imageUrl: string;
  rating?: string;
  episodeCount?: string;
  isNew?: boolean;
  source?: keyof typeof VIDEO_SOURCES;
}

const ContentCard = ({ id, title, imageUrl, rating, episodeCount, isNew, source }: ContentCardProps) => {
  return (
    <Link to={`/detail/${id}${source ? `/${source}` : ''}`} className="block">
      <div className="content-card group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.04] shadow-sm">
        <div className="relative pb-[140%]">
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Rating badge */}
          {rating && (
            <div className="absolute top-1 left-1 rating-badge">
              {rating}
            </div>
          )}

          {/* Episode count */}
          {episodeCount && (
            <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
              {episodeCount}
            </div>
          )}

          {/* New badge */}
          {isNew && (
            <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1">
              NEW
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/45">
            <div className="play-icon p-3 rounded-full bg-white/90 shadow-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="p-3">
          <h3 className="text-sm font-medium line-clamp-1" title={title}>
            {title}
          </h3>
        </div>
      </div>
    </Link>
  );
};

export default ContentCard;
