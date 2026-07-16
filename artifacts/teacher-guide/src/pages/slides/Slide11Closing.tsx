export default function Slide11Closing() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#0d1f4a",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "6vh 7vw",
        boxSizing: "border-box",
      }}
    >
      {/* Background glow — right */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "45vw",
          height: "100vh",
          background: "radial-gradient(ellipse at 80% 50%, rgba(30,58,138,0.6) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Background glow — bottom left gold */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "30vw",
          height: "40vh",
          background: "radial-gradient(ellipse at 20% 80%, rgba(245,158,11,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Shepherd Connect
        </div>
        <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>
          RCCG City of David · 2026
        </div>
      </div>

      {/* Centre content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
          marginTop: "-4vh",
        }}
      >
        <div
          style={{
            display: "inline-block",
            backgroundColor: "rgba(245,158,11,0.15)",
            border: "0.1vw solid rgba(245,158,11,0.3)",
            color: "#f59e0b",
            fontSize: "1vw",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "0.5vh 1.5vw",
            borderRadius: "2vw",
            marginBottom: "3.5vh",
          }}
        >
          Teacher Guide
        </div>

        <h2
          style={{
            fontSize: "7.5vw",
            fontWeight: 200,
            letterSpacing: "-0.05em",
            margin: "0 0 3vh 0",
            lineHeight: 1.05,
            color: "#ffffff",
          }}
        >
          Safe.{" "}
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>Known.</span>{" "}
          Celebrated.
        </h2>
        <p
          style={{
            fontSize: "1.9vw",
            fontWeight: 300,
            color: "rgba(255,255,255,0.6)",
            maxWidth: "52vw",
            lineHeight: 1.5,
            letterSpacing: "-0.01em",
            marginBottom: "7vh",
          }}
        >
          Thank you for the care you give each Sunday. Shepherd Connect exists to support you so every child in your class is truly known and celebrated.
        </p>

        <div style={{ display: "flex", gap: "5vw" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Login</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
          </div>
          <div style={{ width: "0.1vw", backgroundColor: "rgba(255,255,255,0.15)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Support</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "rgba(255,255,255,0.6)" }}>admin@shepherd.com</div>
          </div>
          <div style={{ width: "0.1vw", backgroundColor: "rgba(255,255,255,0.15)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8vh" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Questions</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "rgba(255,255,255,0.6)" }}>Speak to any admin</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "rgba(255,255,255,0.2)", letterSpacing: "0.02em" }}>
          Shepherd Connect · Teacher Guide · 2026
        </div>
      </div>
    </div>
  );
}
