export function Logo({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2e7d32" />
          <stop offset="1" stopColor="#b9f6a6" />
        </linearGradient>
      </defs>
      <path d="M52 8C26 8 10 22 10 42c0 6 2 10 4 14 3-12 12-24 26-30-11 8-18 18-21 30 26 2 39-18 33-48z" fill="url(#lg)" />
    </svg>
  );
}
