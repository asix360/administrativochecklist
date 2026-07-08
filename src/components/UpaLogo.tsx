import React from 'react';

interface UpaLogoProps {
  variant?: 'full' | 'horizontal' | 'compact' | 'light';
  className?: string;
}

export default function UpaLogo({ variant = 'full', className = '' }: UpaLogoProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <img 
          src="/logo.png" 
          alt="Logo UPA 24h" 
          className="h-8 w-auto object-contain bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm" 
        />
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center select-none ${className}`}>
        <div className="shrink-0 bg-white p-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
          <img 
            src="/logo.png" 
            alt="Logo UPA 24h" 
            className="h-9 w-auto object-contain" 
          />
        </div>
        <div className="flex flex-col ml-3">
          <span className="text-[11px] font-black tracking-tight text-white uppercase leading-none">
            UPA 24h
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-tight mt-0.5">
            Dr. L. Lindbergh
          </span>
        </div>
      </div>
    );
  }

  // Full and light variants (Login page, PDF reports, etc.)
  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex items-center justify-center max-w-[280px] mx-auto">
        <img 
          src="/logo.png" 
          alt="Logo UPA 24h" 
          className="h-24 w-auto object-contain" 
        />
      </div>
    </div>
  );
}
