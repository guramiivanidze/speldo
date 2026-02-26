'use client';

import { Division, DIVISION_CONFIG, DIVISION_THRESHOLDS } from '@/types/competitive';

interface RatingDisplayProps {
  rating: number;
  division: Division;
  pointsToNext?: number;
  nextDivision?: Division | null;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
}

export default function RatingDisplay({
  rating,
  division,
  pointsToNext,
  nextDivision,
  size = 'md',
  showProgress = true,
}: RatingDisplayProps) {
  const config = DIVISION_CONFIG[division];
  
  // Calculate progress within division
  const currentThreshold = DIVISION_THRESHOLDS[division];
  const nextThreshold = nextDivision ? DIVISION_THRESHOLDS[nextDivision] : rating + 100;
  const progressInDivision = nextDivision 
    ? ((rating - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    : 100;

  const sizeClasses = {
    sm: { rating: 'text-xl', label: 'text-xs' },
    md: { rating: 'text-3xl', label: 'text-sm' },
    lg: { rating: 'text-5xl', label: 'text-base' },
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Rating number */}
      <div 
        className={`${sizeClasses[size].rating} font-bold`}
        style={{ color: config.color }}
      >
        {rating}
      </div>
      
      {/* Division icon and name */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{config.icon}</span>
        <span 
          className={`${sizeClasses[size].label} font-semibold`}
          style={{ color: config.color }}
        >
          {division}
        </span>
      </div>

      {/* Progress to next division */}
      {showProgress && nextDivision && pointsToNext !== undefined && (
        <div className="w-full max-w-xs mt-2">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{division}</span>
            <span>{nextDivision}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${Math.min(progressInDivision, 100)}%`,
                backgroundColor: config.color,
              }}
            />
          </div>
          <div className="text-center text-xs text-slate-400 mt-1">
            {pointsToNext} points to {nextDivision}
          </div>
        </div>
      )}
    </div>
  );
}
