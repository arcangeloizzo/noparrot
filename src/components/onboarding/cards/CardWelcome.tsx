import { CardBase } from "./CardBase";
import { LogoVertical } from "@/components/ui/LogoVertical";

export const CardWelcome = () => (
  <CardBase
    eyebrow={
      <>
        <span
          style={{
            width: 26,
            height: 26,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <LogoVertical hideText={true} className="w-full h-full" />
        </span>
        <span>Benvenuto su NoParrot</span>
      </>
    }
    title={
      <>
        NON FARE IL
        <br />
        PAPPAGALLO.
      </>
    }
    body={
      <>
        I social premiano chi ripete più forte. Qui si entra nella conversazione
        solo <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>dopo aver capito</strong>{" "}
        di cosa parla.
      </>
    }
  />
);