import React from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showText?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  size = 72,
  strokeWidth = 6,
  color = '#6366f1',
  showText = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedPercent = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (clampedPercent / 100) * circumference;

  // Dynamic color matching psychological status
  const ringColor =
    clampedPercent >= 80 ? '#10b981' : clampedPercent >= 50 ? '#6366f1' : clampedPercent > 0 ? '#f59e0b' : '#4b5563';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f2638"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease',
          }}
        />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold text-white tracking-tight">{clampedPercent}%</span>
        </div>
      )}
    </div>
  );
};
