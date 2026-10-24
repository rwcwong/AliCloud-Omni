const PATH_D = 'M 0,22 L 22,22 C 30,22 30,70 36,70 L 64,70 C 70,70 70,22 78,22 L 100,22';

function LightBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[35px] z-[1]" style={{ height: '120px' }} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        <defs>
          <filter id="lb-3d" x="-10%" y="-50%" width="120%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.4" />
            <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#00d2ff" floodOpacity="0.15" />
          </filter>
          <linearGradient id="lb-face" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="50%" stopColor="#f0f9ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d={PATH_D} stroke="url(#lb-face)" strokeWidth="6" strokeLinecap="round" filter="url(#lb-3d)" vectorEffect="non-scaling-stroke" />
        <path d={PATH_D} stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default LightBar;
