import React from "react";

export const KyberLogo = ({ size = 40, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Crystal shape with financial theme */}
      <defs>
        <linearGradient id="kyberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="kyberGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      {/* Outer crystal facets */}
      <polygon
        points="50,5 85,30 85,70 50,95 15,70 15,30"
        fill="none"
        stroke="url(#kyberGradient)"
        strokeWidth="2"
        filter="url(#glow)"
      />
      
      {/* Inner crystal */}
      <polygon
        points="50,15 75,35 75,65 50,85 25,65 25,35"
        fill="url(#kyberGradient)"
        opacity="0.2"
      />
      
      {/* Central diamond (currency symbol abstraction) */}
      <polygon
        points="50,25 65,50 50,75 35,50"
        fill="url(#kyberGradient)"
        filter="url(#glow)"
      />
      
      {/* Crystal inner lines */}
      <line x1="50" y1="15" x2="50" y2="25" stroke="url(#kyberGradient2)" strokeWidth="1.5" />
      <line x1="50" y1="75" x2="50" y2="85" stroke="url(#kyberGradient2)" strokeWidth="1.5" />
      <line x1="25" y1="35" x2="35" y2="50" stroke="url(#kyberGradient2)" strokeWidth="1.5" />
      <line x1="75" y1="35" x2="65" y2="50" stroke="url(#kyberGradient2)" strokeWidth="1.5" />
      <line x1="25" y1="65" x2="35" y2="50" stroke="url(#kyberGradient2)" strokeWidth="1.5" />
      <line x1="75" y1="65" x2="65" y2="50" stroke="url(#kyberGradient2)" strokeWidth="1.5" />
      
      {/* Dollar sign abstraction inside */}
      <path
        d="M50 35 L50 65 M45 40 Q50 35 55 40 Q50 50 45 55 Q50 65 55 60"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const KyberLogoWithText = ({ size = 40, className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <KyberLogo size={size} />
      <span className="font-heading font-bold text-xl gradient-text">
        KyberBusiness
      </span>
    </div>
  );
};
