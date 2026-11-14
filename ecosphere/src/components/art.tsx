// Decorative artwork recreating the mockup's glowing leaf look. Pure SVG, no images.

export function LeafHero({ children, size = 240 }: { children?: React.ReactNode; size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 drop-shadow-[0_0_30px_rgba(134,214,126,.35)]" aria-hidden>
        <defs>
          <linearGradient id="leafFill" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#1f5a2a" />
            <stop offset=".55" stopColor="#3f9a48" />
            <stop offset="1" stopColor="#9be292" />
          </linearGradient>
          <radialGradient id="leafShine" cx=".7" cy=".25" r=".6">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M178 14C96 10 30 46 22 116c-4 34 10 60 26 72 4-40 30-84 78-118-40 36-62 76-66 120 78 4 128-60 118-176z" fill="url(#leafFill)" />
        <path d="M178 14C96 10 30 46 22 116c-4 34 10 60 26 72 4-40 30-84 78-118-40 36-62 76-66 120 78 4 128-60 118-176z" fill="url(#leafShine)" />
        <g stroke="#c8f5c0" strokeOpacity=".25" strokeWidth="1.2" fill="none">
          <path d="M60 190C80 120 120 70 170 22" />
          <path d="M95 120c-20-6-36-4-50 4M112 96c-16-10-34-12-50-8M130 74c-12-12-26-18-42-18M120 110c18 4 34 2 48-6M138 86c14 0 28-6 38-16" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pl-6 pt-4 text-center">{children}</div>
    </div>
  );
}

export function LeafLogo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="drop-shadow-[0_0_18px_rgba(134,214,126,.45)]">
      <defs>
        <linearGradient id="logoG" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2e7d32" />
          <stop offset="1" stopColor="#b9f6a6" />
        </linearGradient>
      </defs>
      <path d="M56 6C30 6 10 20 10 42c0 6 2 10 4 14 3-12 12-24 26-30-11 8-18 18-21 30 26 2 41-18 37-50z" fill="url(#logoG)" />
      <path d="M17 54C24 38 34 28 48 16" stroke="#0e2a12" strokeOpacity=".5" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

// Faint leaves behind profile headers, like the mockup.
export function LeafDecor() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 w-full opacity-40" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="#1d3a22">
        <path d="M300 20c-40 30-50 90-20 140 40-30 50-90 20-140z" />
        <path d="M330 140c-50-10-90 20-100 60 50 10 90-20 100-60z" opacity=".7" />
        <path d="M60 60c40 20 60 70 40 120-40-20-60-70-40-120z" opacity=".6" />
        <path d="M20 200c40-20 90-10 110 30-40 20-90 10-110-30z" opacity=".5" />
      </g>
    </svg>
  );
}

// Planet horizon glow for the splash screen.
export function PlanetGlow() {
  return (
    <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="planet" cx=".75" cy=".05" r=".9">
          <stop offset=".55" stopColor="#0b1a0e" stopOpacity="0" />
          <stop offset=".72" stopColor="#1f5a2a" stopOpacity=".55" />
          <stop offset=".76" stopColor="#0a140c" stopOpacity=".9" />
          <stop offset="1" stopColor="#050806" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hill" cx=".5" cy="1" r=".7">
          <stop offset="0" stopColor="#163d1d" />
          <stop offset="1" stopColor="#050806" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#planet)" />
      <ellipse cx="80" cy="760" rx="220" ry="140" fill="url(#hill)" />
      <ellipse cx="380" cy="780" rx="180" ry="120" fill="url(#hill)" />
    </svg>
  );
}
