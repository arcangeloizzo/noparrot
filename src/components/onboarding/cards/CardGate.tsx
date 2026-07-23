import { CardBase } from "./CardBase";

const OPTIONS = [
  { text: "Le AI sostituiranno i giornalisti", selected: false },
  { text: "La velocità ha sostituito la comprensione", selected: true },
  { text: "I social vanno regolamentati", selected: false },
];

export const CardGate = () => (
  <CardBase
    eyebrow={<span style={{ color: "#0A7AFF" }}>Il Comprehension Gate</span>}
    title={
      <>
        PRIMA CAPISCI.
        <br />
        POI PARLI.
      </>
    }
    body={
      <>
        Vuoi condividere un contenuto in NoParrot o commentare un post di un
        utente? L'AI ti fa{" "}
        <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>tre domande</strong>{" "}
        su quello che c'è scritto. Un errore ci sta.{" "}
        <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>
          Al secondo, si rilegge.
        </strong>
      </>
    }
    extra={
      <div
        aria-hidden
        style={{
          background: "rgba(26, 35, 54, 0.72)",
          borderRadius: 18,
          padding: "16px 16px 14px 16px",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 9.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            marginBottom: 10,
          }}
        >
          Domanda 1 · 3
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            lineHeight: 1.35,
            color: "#FFFFFF",
            marginBottom: 12,
          }}
        >
          Qual è la tesi centrale dell'articolo?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {OPTIONS.map((o, i) => (
            <div
              key={i}
              style={{
                height: 36,
                borderRadius: 10,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                color: o.selected ? "#FFFFFF" : "rgba(255,255,255,0.72)",
                background: o.selected
                  ? "rgba(10,122,255,0.14)"
                  : "rgba(255,255,255,0.03)",
                border: o.selected
                  ? "1px solid rgba(10,122,255,0.45)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {o.text}
            </div>
          ))}
        </div>
      </div>
    }
  />
);