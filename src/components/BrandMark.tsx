import React, { useState } from 'react';

interface BrandMarkProps {
  studioName?: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'light';
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  studioName = 'LOUIS BRIDES',
  logoUrl,
  size = 'md',
  tone = 'dark',
}) => {
  const [imgError, setImgError] = useState(false);

  const iconDimensions =
    size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const titleSize =
    size === 'sm'
      ? 'text-lg'
      : size === 'lg'
      ? 'text-2xl sm:text-3xl'
      : 'text-xl';

  const textColor = tone === 'light' ? 'text-[#FAF7F2]' : 'text-[#2A201B]';
  const accentColor = tone === 'light' ? 'text-[#E3C78D]' : 'text-[#8C6B30]';

  return (
    <span className="inline-flex items-center gap-3 select-none shrink-0">
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={studioName}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${iconDimensions} rounded-full object-cover border border-[#C6A464]/50 shrink-0`}
        />
      ) : (
        <span
          className={`${iconDimensions} rounded-full border border-[#C6A464]/60 bg-[#F3ECE1] flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 36 36"
            className="w-5 h-5 text-[#8C6B30]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <circle cx="18" cy="18" r="15" strokeOpacity="0.45" />
            <path
              d="M12.5 11.5V24.5H18.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.5 11.5H23.2C24.8 11.5 25.8 12.4 25.8 13.8C25.8 15 24.9 15.8 23.7 16C25.1 16.2 26.1 17.2 26.1 18.7C26.1 20.4 24.8 21.5 22.8 21.5H19.5V11.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      <span
        className={`font-serif font-semibold tracking-[0.14em] uppercase whitespace-nowrap ${titleSize} ${textColor}`}
      >
        {studioName}
        <span className={`sr-only`}> — Photography Studio</span>
      </span>
      <span className={`hidden ${accentColor}`} aria-hidden="true" />
    </span>
  );
};
