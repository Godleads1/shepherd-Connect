export default function Slide7Emergencies() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#1a0808",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: "50vw", height: "50vh", background: "radial-gradient(ellipse at 10% 10%, rgba(220,38,38,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "40vw", height: "40vh", background: "radial-gradient(ellipse at 90% 90%, rgba(30,58,138,0.3) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ backgroundColor: "rgba(220,38,38,0.2)", borderBottom: "0.1vw solid rgba(220,38,38,0.4)", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#fca5a5", letterSpacing: "-0.02em" }}>Emergency Management</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden", position: "relative" }}>

        {/* Left: how to use */}
        <div style={{ flex: "0 0 38vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.3vw", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.5, margin: 0 }}>
            Any admin can log an incident. Super admins can see the full emergency log, export it, and escalate as needed.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Logging an emergency</div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Navigate to Emergencies</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Available to admins and super admins from the sidebar</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Log New Incident</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Enter type, child involved, description, and immediate action taken</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Export for safeguarding records</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Download all incidents as CSV for your church's formal records</div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

        {/* Right: incident types */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Common incident types</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "0.1vw solid rgba(220,38,38,0.3)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "center" }}>
              <div style={{ width: "0.5vw", height: "4vh", backgroundColor: "#dc2626", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#fca5a5" }}>Medical</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>Allergic reaction, injury, or sudden illness</div>
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "0.1vw solid rgba(245,158,11,0.25)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "center" }}>
              <div style={{ width: "0.5vw", height: "4vh", backgroundColor: "#f59e0b", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#fde68a" }}>Missing Child</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>Child not found at expected location or time</div>
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(124,58,237,0.15)", border: "0.1vw solid rgba(124,58,237,0.3)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "center" }}>
              <div style={{ width: "0.5vw", height: "4vh", backgroundColor: "#7c3aed", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#c4b5fd" }}>Behavioural</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>Significant disruptive or aggressive incident</div>
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(30,58,138,0.3)", border: "0.1vw solid rgba(30,58,138,0.5)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "center" }}>
              <div style={{ width: "0.5vw", height: "4vh", backgroundColor: "#1e3a8a", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#93c5fd" }}>Security</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.3 }}>Unauthorised person, suspicious activity on site</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "0.1vw solid rgba(255,255,255,0.08)", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>Shepherd Connect · Super Admin Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.35)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
