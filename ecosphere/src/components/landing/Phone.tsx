// CSS-3D smartphone: one body with a front face (glass, screen, island) and a back face (camera module),
// joined by four thickness edges, so it can rotate for real instead of swapping images.
// `screen` is the live UI; the frame never re-renders when it changes.
export function Phone({ screen, back }: { screen: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="phone" data-phone aria-hidden>
      <div className="phone-face phone-front">
        <div className="phone-glass">
          <div className="phone-screen" data-screen-root>{screen}</div>
          <div className="phone-island" />
          <div className="phone-glare" data-glare />
        </div>
      </div>
      <div className="phone-face phone-back">
        <div className="phone-camera">
          <span className="lens lens-a" /><span className="lens lens-b" /><span className="lens lens-c" />
          <span className="flash" /><span className="mic" />
        </div>
        <svg className="phone-back-logo" viewBox="0 0 64 64" aria-hidden>
          <path d="M56 6C30 6 10 20 10 42c0 6 2 10 4 14 3-12 12-24 26-30-11 8-18 18-21 30 26 2 41-18 37-50z" fill="currentColor" />
        </svg>
        {back}
      </div>
      <span className="phone-edge edge-l"><i className="btn-action" /><i className="btn-vol" /><i className="btn-vol2" /></span>
      <span className="phone-edge edge-r"><i className="btn-power" /></span>
      <span className="phone-edge edge-t" />
      <span className="phone-edge edge-b" />
    </div>
  );
}
