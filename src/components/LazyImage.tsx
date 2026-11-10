import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatioClass?: string;
  onClick?: () => void;
  rootMargin?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatioClass = 'aspect-4/3',
  onClick,
  rootMargin = '250px',
}) => {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Reset loaded state when src changes
    setIsLoaded(false);
    setHasError(false);

    if (!containerRef.current) return;

    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [src, rootMargin]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative ${aspectRatioClass} bg-[#F3ECE1] overflow-hidden select-none ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Skeleton Shimmer Loading Placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#F5EFE6] via-[#EFE6D8] to-[#E8DCB9]/40 animate-pulse">
          <ImageIcon className="w-6 h-6 text-[#8C6B30]/35 animate-bounce" />
          <span className="text-[10px] uppercase tracking-widest text-[#75655A]/50 mt-1 font-mono">
            Preview
          </span>
        </div>
      )}

      {/* Actual Thumbnail Image - only loads when in viewport */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
        />
      )}

      {/* Fallback Error Placeholder */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F3ECE1] text-[#75655A] p-2 text-center">
          <ImageIcon className="w-6 h-6 text-[#9E2A2B]/50 mb-1" />
          <span className="text-[10px] font-mono line-clamp-1">{alt}</span>
          <span className="text-[9px] text-[#8C6B30]">Pratinjau Foto</span>
        </div>
      )}
    </div>
  );
};
