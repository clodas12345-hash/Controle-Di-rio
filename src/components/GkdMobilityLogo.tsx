import React, { useState } from 'react';
import appLogo from '../assets/icon2.png';

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
  const [imgError, setImgError] = useState(false);

  const dimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    hero: 'w-24 h-24 sm:w-28 sm:h-28'
  }[size];

  return (
    <div className={`relative inline-flex items-center justify-center select-none overflow-hidden bg-white/95 p-0 border border-white/20 shadow-sm ${rounded ? 'rounded-xl' : ''} ${dimensions} ${className}`}>
      {!imgError ? (
        <img
          src={appLogo}
          alt="GKD Mobility Logo Oficial"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover drop-shadow-sm transition-transform duration-200 hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 font-black text-xs">
          GKD
        </div>
      )}
    </div>
  );
};

