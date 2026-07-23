import { ReactNode } from "react";

interface CardBaseProps {
  eyebrow: ReactNode;
  title: ReactNode;
  body: ReactNode;
  extra?: ReactNode;
}

/**
 * Common layout for onboarding snap cards: eyebrow + Anton title + Inter body,
 * optional extra block below. Content aligned left, centered vertically, with
 * padding right of 40px to leave room for the progress rail.
 */
export const CardBase = ({ eyebrow, title, body, extra }: CardBaseProps) => (
  <section
    style={{
      scrollSnapAlign: "start",
      scrollSnapStop: "always",
      height: "100dvh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      padding:
        "max(env(safe-area-inset-top, 0px), 56px) 40px max(env(safe-area-inset-bottom, 0px), 72px) 26px",
      boxSizing: "border-box",
    }}
  >
    <div style={{ width: "100%", maxWidth: 520 }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.68)",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontFamily: "'Anton', 'Impact', sans-serif",
          fontSize: 43,
          lineHeight: 0.98,
          letterSpacing: "0.005em",
          textTransform: "uppercase",
          color: "#FFFFFF",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.74)",
          margin: "18px 0 0 0",
        }}
      >
        {body}
      </p>
      {extra ? <div style={{ marginTop: 26 }}>{extra}</div> : null}
    </div>
  </section>
);