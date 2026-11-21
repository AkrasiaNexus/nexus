// Decorative artwork recreating the mockup's glowing leaf look. Pure SVG, no images.

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
