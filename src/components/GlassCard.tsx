import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

/**
 * Performant Specular Glassmorphism Card
 * Pure CSS hardware-accelerated styling with static top specular highlight.
 * Removed mouse event listeners to achieve 60fps performance without CPU lag.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  glow = true,
  ...props
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#12151f]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] transition-all duration-200 hover:border-white/[0.14] ${className}`}
      {...props}
    >
      {/* Top Edge Ambient Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
