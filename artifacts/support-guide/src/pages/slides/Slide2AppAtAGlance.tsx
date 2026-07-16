export default function Slide2AppAtAGlance() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        color: "#1d1d1f",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          backgroundColor: "#1e3a8a",
          padding: "2vh 6vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
          <div style={{ fontSize: "2vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.03em" }}>
            Shepherd Connect
          </div>
          <div
            style={{
              backgroundColor: "#f59e0b",
              color: "#1d1d1f",
              fontSize: "0.85vw",
              fontWeight: 700,
              padding: "0.4vh 1vw",
              borderRadius: "2vw",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Attendant Guide
          </div>
        </div>
        <div style={{ fontSize: "1.4vw", fontWeight: 300, color: "rgba(255,255,255,0.75)", letterSpacing: "-0.01em" }}>
          Your Sunday workflow — at a glance
        </div>
      </div>

      {/* Sunday workflow */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "2.5vh 5vw 2vh",
          borderBottom: "0.15vw solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2vh" }}>
          Your kiosk workflow
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2vw", fontWeight: 800, color: "#f59e0b", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>1</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Open Check-In</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "9vw" }}>Navigate to the Check-In page</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "3vh" }}>→</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#2563eb", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2vw", fontWeight: 800, color: "#ffffff", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>2</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Scan or Search</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "9vw" }}>QR code or child name</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "3vh" }}>→</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2vw", fontWeight: 800, color: "#1d1d1f", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>3</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Confirm Check-In</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "9vw" }}>Verify identity &amp; confirm</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "3vh" }}>→</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2vw", fontWeight: 800, color: "#f59e0b", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>4</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Checkout</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "9vw" }}>Parent or OTP delegate</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "3vh" }}>→</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2vw", fontWeight: 800, color: "#ffffff", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>5</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Child Released</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "9vw" }}>Status updates to parent</div>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1.2vw",
          padding: "2vh 4vw 2vh",
          overflow: "hidden",
        }}
      >
        {/* Check-In */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#1e3a8a", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.8vh" }}>Check-In Kiosk</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>QR scan or name search</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>View allergy &amp; medical notes</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Auto-notifies teacher</div>
        </div>

        {/* Standard Checkout */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#2563eb", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.8vh" }}>Standard Checkout</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Select child → verify parent</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Confirm face matches record</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Tap Confirm Checkout</div>
        </div>

        {/* OTP Delegate */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#f59e0b", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.8vh" }}>Delegate OTP</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Delegate shows 6-digit code</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Use "Delegate OTP" tab</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Code valid 24 h — single use</div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#1e3a8a",
          padding: "1.2vh 6vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>
          Shepherd Connect · Attendant Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
