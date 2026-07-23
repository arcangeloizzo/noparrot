import parrotLogo from "@/assets/parrot-logo.png";
import { CardBase } from "./CardBase";

export const CardWelcome = () => (
  <CardBase
    eyebrow={
      <>
        <img
          src={parrotLogo}
          alt=""
          style={{ width: 26, height: 26, objectFit: "contain", display: "block" }}
        />
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