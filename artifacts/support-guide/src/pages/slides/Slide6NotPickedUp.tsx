export default function Slide6NotPickedUp() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Not-Picked-Up Report</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left */}
        <div style={{ flex: "0 0 40vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
            As service ends, run the Not-Picked-Up report to see all children still on site. It shows parent contact numbers so you can reach families quickly.
          </p>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>How to use the report</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Open Reports</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Go to Reports in the sidebar and select "Not Picked Up"</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Review the live list</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>All children currently checked in but not yet collected are shown here</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Contact parents</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Parent phone numbers are shown on each row. Call or send a notification directly</div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: sample report + what to do */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Sample report view</div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1vw", overflow: "hidden", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)" }}>
            <div style={{ backgroundColor: "#fee2e2", padding: "1vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 1fr 10vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#7f1d1d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Child</div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#7f1d1d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Parent</div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#7f1d1d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Phone</div>
            </div>
            <div style={{ padding: "1vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 1fr 10vw", borderTop: "0.1vw solid #fef2f2" }}>
              <div style={{ fontSize: "1.05vw", color: "#374151", fontWeight: 500 }}>Aiden Okafor</div>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>James Okafor</div>
              <div style={{ fontSize: "1.05vw", color: "#dc2626", fontWeight: 600 }}>+234 801…</div>
            </div>
            <div style={{ padding: "1vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 1fr 10vw", borderTop: "0.1vw solid #fef2f2", backgroundColor: "#fff5f5" }}>
              <div style={{ fontSize: "1.05vw", color: "#374151", fontWeight: 500 }}>Emeka Adeyemi</div>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>Ruth Adeyemi</div>
              <div style={{ fontSize: "1.05vw", color: "#dc2626", fontWeight: 600 }}>+234 802…</div>
            </div>
            <div style={{ padding: "1vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 1fr 10vw", borderTop: "0.1vw solid #fef2f2" }}>
              <div style={{ fontSize: "1.05vw", color: "#374151", fontWeight: 500 }}>Sophia Nwosu</div>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>David Nwosu</div>
              <div style={{ fontSize: "1.05vw", color: "#dc2626", fontWeight: 600 }}>+234 803…</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fef3c7", border: "0.1vw solid #fde68a", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#92400e", marginBottom: "0.4vh" }}>If a child is still present after 30 minutes</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>Escalate to an admin. Do not allow the child to wait unattended or leave with an unknown adult.</div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.4 }}>The list updates live — refresh the page to see the latest status as parents arrive.</div>
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
