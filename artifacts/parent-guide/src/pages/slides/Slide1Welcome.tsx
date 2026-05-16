const base = import.meta.env.BASE_URL;

export default function Slide1Welcome() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <img
        src={`${base}hero.png`}
        crossOrigin="anonymous"
        alt="Parent and child at church"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to right, rgba(10,20,60,0.82) 45%, rgba(10,20,60,0.35) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "6vh 7vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Shepherd Connect
          </div>
          <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>
            Parent Guide · 2026
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "52vw" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#f59e0b",
              color: "#1d1d1f",
              fontSize: "1vw",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0.5vh 1.2vw",
              borderRadius: "0.3vw",
              marginBottom: "3vh",
              width: "fit-content",
            }}
          >
            RCCG City of David
          </div>
          <h1
            style={{
              fontSize: "7.5vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Welcome to{" "}
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>
              Shepherd
            </span>
            <span style={{ fontWeight: 200, color: "#ffffff" }}> Connect</span>
          </h1>
          <p
            style={{
              fontSize: "2vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.75)",
              marginTop: "3vh",
              letterSpacing: "-0.01em",
              lineHeight: 1.45,
            }}
          >
            Your guide to keeping your children{" "}
            <span style={{ color: "#f59e0b", fontWeight: 500 }}>safe</span>,{" "}
            <span style={{ color: "#f59e0b", fontWeight: 500 }}>known</span>, and{" "}
            <span style={{ color: "#f59e0b", fontWeight: 500 }}>celebrated</span>.
          </p>
        </div>

        <div style={{ fontSize: "1vw", fontWeight: 400, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
