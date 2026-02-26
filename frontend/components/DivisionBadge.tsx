'use client';

import { Division, DIVISION_CONFIG } from '@/types/competitive';

interface DivisionBadgeProps {
  division: Division;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
}

export default function DivisionBadge({ 
  division, 
  size = 'md', 
  showIcon = true, 
  showLabel = true 
}: DivisionBadgeProps) {
  const config = DIVISION_CONFIG[division];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  };

  const iconSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full
        ${sizeClasses[size]}
      `}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}40`,
      }}
    >
      {showIcon && <span className={iconSize[size]}>{config.icon}</span>}
      {showLabel && <span>{division}</span>}
    </span>
  );
}
