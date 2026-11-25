interface BrandLogoProps {
  variant?: 'light' | 'dark';
  showTagline?: boolean;
  compact?: boolean;
}

export function BrandLogo({
  variant = 'dark',
  showTagline = false,
  compact = false,
}: BrandLogoProps) {
  const isLight = variant === 'light';
  const primaryFill = isLight ? '#FFFFFF' : '#0F223A';
  const secondaryStroke = isLight ? 'rgba(255,255,255,0.45)' : '#536878';
  const accentFill = isLight ? '#D3D1CE' : '#2F466F';

  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        width={compact ? 28 : 34}
        height={compact ? 28 : 34}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1.5"
          y="1.5"
          width="33"
          height="33"
          rx="8"
          stroke={secondaryStroke}
          strokeWidth="1.25"
        />
        <path
          d="M18 7.5L26.5 26.5H22.8L20.8 21.8H15.2L13.2 26.5H9.5L18 7.5ZM18 13.3L16.2 18.4H19.8L18 13.3Z"
          fill={primaryFill}
        />
        <circle cx="26.5" cy="9.5" r="2.25" fill={accentFill} />
      </svg>
      <div className="min-w-0">
        <span
          className={`font-display font-semibold tracking-tight whitespace-nowrap block leading-none ${
            compact ? 'text-[17px]' : 'text-[19px]'
          } ${isLight ? 'text-white' : 'text-[#0F223A]'}`}
        >
          AttendIQ
        </span>
        {showTagline && (
          <span
            className={`block text-[11px] tracking-[0.02em] mt-1 whitespace-nowrap ${
              isLight ? 'text-[#D3D1CE]' : 'text-[#262E36]'
            }`}
          >
            Track Smart. Stay Ahead.
          </span>
        )}
      </div>
    </div>
  );
}
