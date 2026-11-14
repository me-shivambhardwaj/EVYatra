import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EVYatra – Find the right EV. Find the right charger.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#F6FBF9",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              backgroundColor: "#0F8A66",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#FFFFFF" />
            </svg>
          </div>
          <span
            style={{
              fontSize: "44px",
              fontWeight: 800,
              color: "#0F8A66",
              letterSpacing: "-0.03em",
            }}
          >
            EVYatra
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h1
            style={{
              fontSize: "64px",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Find the right EV. Find the right charger.
          </h1>
          <p
            style={{
              fontSize: "28px",
              color: "#475569",
              margin: 0,
              fontWeight: 500,
            }}
          >
            India’s curated EV guide · Real-world range · High-speed charging grid
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            borderTop: "2px solid #E2E8F0",
            paddingTop: "32px",
            fontSize: "22px",
            fontWeight: 600,
            color: "#0F8A66",
          }}
        >
          <span>evyatra.netlify.app</span>
          <span style={{ color: "#94A3B8" }}>•</span>
          <span style={{ color: "#64748B" }}>Built for Indian EV drivers</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
