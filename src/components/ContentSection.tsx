import React from 'react';
import ContentCard from './ContentCard';
import { Video } from '../api/types';

export interface ContentItem {
  id: number;
  title: string;
  imageUrl: string;
  rating?: string;
  episodeCount?: string;
  isNew?: boolean;
}

interface ContentSectionProps {
  title: string;
  items: (ContentItem | Video)[];
  seeMoreLink?: string;
  loading?: boolean;
}

const ContentCardSkeleton = () => {
  return (
    <div className="content-card relative bg-[var(--app-surface)] rounded-md overflow-hidden shadow-sm">
      <div className="relative pb-[140%]">
        <div className="absolute inset-0 w-full h-full skeleton-fill animate-pulse" />
      </div>
      <div className="p-2">
        <div className="h-4 skeleton-fill rounded animate-pulse mb-1" />
        <div className="h-3 skeleton-fill rounded animate-pulse w-3/4" />
      </div>
    </div>
  );
};

const ContentSection = ({ title, items, seeMoreLink, loading = false }: ContentSectionProps) => {
  const convertToContentItem = (item: ContentItem | Video): ContentItem => {
    if ('vod_id' in item) {
      return {
        id: item.vod_id,
        title: item.vod_name,
        imageUrl: item.vod_pic,
        rating: item.vod_score?.toString(),
      };
    }
    return item;
  };

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h2 className="category-heading text-base md:text-lg font-medium">{title}</h2>
        {seeMoreLink && (
          <a href={seeMoreLink} className="text-xs md:text-sm text-gray-500 hover:text-primary">
            查看更多 &gt;
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
        {loading ? (
          Array(6).fill(0).map((_, index) => (
            <ContentCardSkeleton key={index} />
          ))
        ) : (
          items.map((item) => {
            const contentItem = convertToContentItem(item);
            return (
              <ContentCard
                key={contentItem.id}
                id={contentItem.id}
                title={contentItem.title}
                imageUrl={contentItem.imageUrl}
                rating={contentItem.rating}
                episodeCount={contentItem.episodeCount}
                isNew={contentItem.isNew}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default ContentSection;
