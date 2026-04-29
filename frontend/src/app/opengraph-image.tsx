import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'E-Numerak — UAE FTA-Compliant E-Invoicing Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          padding: '64px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '16px',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '42px',
              fontWeight: '800',
              color: 'white',
            }}
          >
            E
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '36px', fontWeight: '800', color: 'white', letterSpacing: '-0.5px' }}>
              E-Numerak
            </span>
            <span style={{ fontSize: '16px', color: '#64748b' }}>
              PEPPOL 5-Corner Platform
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '5px',
              background: '#3b82f6',
              borderRadius: '3px',
            }}
          />
          <div
            style={{
              fontSize: '56px',
              fontWeight: '800',
              color: 'white',
              lineHeight: '1.1',
              letterSpacing: '-1px',
            }}
          >
            UAE FTA-Compliant
            <br />
            E-Invoicing Platform
          </div>
          <div style={{ fontSize: '26px', color: '#94a3b8' }}>
            Generate · Validate · Submit via PEPPOL BIS 3.0
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['FTA Certified', 'PEPPOL BIS 3.0', 'UBL 2.1', 'VAT Compliant'].map((b) => (
            <div
              key={b}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.08)',
                fontSize: '18px',
                fontWeight: '600',
                color: '#93c5fd',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {b}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '20px', color: '#475569', alignSelf: 'center' }}>
            e-numerak.com
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
