export default function Slide8CommonIssues() {
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
      <div style={{ backgroundColor: "#1e3a8a", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Common Issues</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#dc2626", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.5vh" }}>QR code won't scan</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.5 }}>
            Ask the parent to increase screen brightness, or search by the child's name instead. The name search finds the same record.
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#f59e0b", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.5vh" }}>Child not found in search</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.5 }}>
            The child may not be registered. Ask the parent to complete registration through the parent app, then contact an admin to add the child manually if urgent.
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#2563eb", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.5vh" }}>Child already shows as checked in</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.5 }}>
            Do not check in again. Ask the teacher if the child is in their class. If the status appears wrong, call an admin to reset it.
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#7c3aed", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.5vh" }}>OTP code says "invalid"</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.5 }}>
            The code may have expired (over 24 h) or already been used. Ask the delegate to contact the parent for a new OTP. Do not release the child.
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#16a34a", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.5vh" }}>App won't load on the kiosk device</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.5 }}>
            Check the Wi-Fi connection. Try a hard refresh (Ctrl+Shift+R). If the problem persists, use another device or call admin for support.
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#1e3a8a", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginTop: "0.5vh" }}>Parent not listed on the child's record</div>
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.5 }}>
            Only parents registered in the family's profile can checkout. Escalate to admin — do not release to anyone not in the system.
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Attendant Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
