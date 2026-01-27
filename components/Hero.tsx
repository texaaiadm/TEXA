import React from 'react';
import TextType from './TextType';

const Hero: React.FC = () => {
  return (
    <div className="relative pt-8 pb-8 md:pt-14 md:pb-10 px-4 overflow-hidden mb-4 rounded-[32px] md:rounded-[40px] text-center flex flex-col items-center min-h-fit justify-center">
      {/* Optimized background for better readability and faster load */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=2000" 
          alt="Tech Background" 
          className="w-full h-full object-cover grayscale brightness-[0.25] opacity-40"
        />
        <div className="absolute inset-0 pointer-events-none rounded-[32px] md:rounded-[40px] bg-gradient-to-br from-[rgba(255,255,255,0.12)] via-[rgba(255,255,255,0.06)] to-[rgba(255,255,255,0.02)] backdrop-blur-[25px] backdrop-saturate-150 border border-white/35 shadow-[0_8px_32px_0_rgba(0,0,0,0.45)]"></div>
        {/* Very subtle glow to keep vertical space clean */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/5 blur-[80px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center">
        {/* Horizontal Badge Label */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg mb-6 shadow-xl backdrop-blur-md animate-float">
          <span className="text-base">🇮🇩</span>
          <span className="mono text-[9px] md:text-[11px] text-emerald-400 font-bold tracking-[0.15em] uppercase">
            #1 Platform AI Tools Indonesia
          </span>
        </div>
        
        {/* Horizontal & Compact Heading */}
        <h1 className="hero-title font-[900] text-white mb-4 drop-shadow-2xl max-w-6xl">
          Akses <span className="text-emerald-400">AI Tools</span>{' '}
          <TextType 
            text={["Premium", "Eksklusif", "Unlimited"]}
            className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent"
            typingSpeed={100}
            pauseDuration={2000}
            cursorCharacter="_"
          />{' '}
          Tanpa Ribet!
        </h1>

        {/* Compact Sub-description */}
        <p className="text-xs md:text-lg text-slate-300 max-w-4xl mx-auto font-medium leading-normal opacity-90 px-4 mb-6">
          Tools AI tercanggih dunia dalam satu genggaman. <span className="text-white font-bold">Cepat, Aman, & Instan.</span>
        </p>

        {/* Minimalist CTA to save vertical space */}
        <div className="flex items-center gap-4">
          <a href="#marketplace" className="px-7 py-2.5 rounded-xl premium-gradient text-xs md:text-sm font-black text-white shadow-lg hover:scale-105 transition-transform duration-300 flex items-center gap-2">
            Eksplorasi Katalog ⚡
          </a>
        </div>
      </div>
      
      {/* Sharp accent line */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
    </div>
  );
};

export default Hero;
