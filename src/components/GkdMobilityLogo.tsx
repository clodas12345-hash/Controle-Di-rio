import React from 'react';

interface GkdMobilityLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  rounded?: boolean;
}

export const GkdMobilityLogo: React.FC<GkdMobilityLogoProps> = ({ 
  className = '', 
  size = 'md',
  rounded = true
}) => {
  const dimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    hero: 'w-24 h-24 sm:w-28 sm:h-28'
  }[size];

  return (
    <div className={`relative inline-flex items-center justify-center select-none overflow-hidden ${rounded ? 'rounded-xl' : ''} ${dimensions} ${className}`}>
      <img
        src="/icon2.png"
        alt="GKD Mobility Logo Oficial"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
      />
    </div>
  );
};

