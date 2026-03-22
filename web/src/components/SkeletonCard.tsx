import React from 'react';

export const SkeletonCard = () => {
  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col justify-between h-[320px] overflow-hidden relative">
      <div className="shimmer absolute inset-0 opacity-20"></div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="h-6 bg-white/10 rounded-lg w-3/4 shimmer"></div>
          <div className="h-8 w-8 bg-white/10 rounded-full shimmer"></div>
        </div>
        <div className="h-4 bg-white/5 rounded-lg w-1/2 shimmer"></div>
      </div>
      
      <div className="space-y-4 mt-auto pt-4 border-t border-white/5">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-white/10 rounded-lg w-1/3 shimmer"></div>
          <div className="h-4 bg-white/5 rounded-lg w-1/4 shimmer"></div>
        </div>
        <div className="flex justify-between items-center">
          <div className="h-5 bg-white/10 rounded-full w-24 shimmer"></div>
          <div className="h-5 bg-white/10 rounded-full w-20 shimmer"></div>
        </div>
      </div>
    </div>
  );
};

export const SkeletonGrid = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
