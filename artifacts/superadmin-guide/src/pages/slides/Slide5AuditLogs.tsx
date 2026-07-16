export default function Slide5AuditLogs() {
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
      <div style={{ backgroundColor: "#1e3a8a", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Audit Logs</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left panel */}
        <div style={{ flex: "0 0 36vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div>
            <p style={{ fontSize: "1.3vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
              Every action on the platform is recorded automatically — who did what, when, and to which record. The Audit Log is your accountability trail.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>What gets logged</div>

            <div style={{ display: "flex", alignItems: "center", gap: "1vw", padding: "1.2vh 1.2vw", backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw" }}>
              <div style={{ width: "0.5vw", height: "3.5vh", backgroundColor: "#1e3a8a", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>User logins, approvals and role changes</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw", padding: "1.2vh 1.2vw", backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw" }}>
              <div style={{ width: "0.5vw", height: "3.5vh", backgroundColor: "#2563eb", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>Child check-in and checkout events</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw", padding: "1.2vh 1.2vw", backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw" }}>
              <div style={{ width: "0.5vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>Delegate OTP creation and use</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw", padding: "1.2vh 1.2vw", backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw" }}>
              <div style={{ width: "0.5vw", height: "3.5vh", backgroundColor: "#dc2626", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>Emergency incidents logged or resolved</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1vw", padding: "1.2vh 1.2vw", backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw" }}>
              <div style={{ width: "0.5vw", height: "3.5vh", backgroundColor: "#7c3aed", borderRadius: "0.3vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>Family and child record modifications</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: sample log */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.8vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Sample log entries</div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1vw", overflow: "hidden", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)" }}>
            <div style={{ backgroundColor: "#f1f5f9", padding: "1vh 1.5vw", display: "grid", gridTemplateColumns: "14vw 8vw 1fr", gap: "1vw" }}>
              <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>User</div>
              <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</div>
              <div style={{ fontSize: "0.9vw", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Action</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "1.1vh 1.5vw", display: "grid", gridTemplateColumns: "14vw 8vw 1fr", gap: "1vw", borderTop: "0.1vw solid #f1f5f9" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#1d1d1f" }}>superadmin</div>
                <div style={{ fontSize: "1.05vw", color: "#64748b" }}>09:02</div>
                <div style={{ fontSize: "1.05vw", color: "#374151" }}>Approved account — Jane Smith (admin)</div>
              </div>
              <div style={{ padding: "1.1vh 1.5vw", display: "grid", gridTemplateColumns: "14vw 8vw 1fr", gap: "1vw", borderTop: "0.1vw solid #f1f5f9", backgroundColor: "#fafafa" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#1d1d1f" }}>attendant1</div>
                <div style={{ fontSize: "1.05vw", color: "#64748b" }}>09:14</div>
                <div style={{ fontSize: "1.05vw", color: "#374151" }}>Checked in — Aiden Okafor (Nursery)</div>
              </div>
              <div style={{ padding: "1.1vh 1.5vw", display: "grid", gridTemplateColumns: "14vw 8vw 1fr", gap: "1vw", borderTop: "0.1vw solid #f1f5f9" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#1d1d1f" }}>parent1</div>
                <div style={{ fontSize: "1.05vw", color: "#64748b" }}>09:30</div>
                <div style={{ fontSize: "1.05vw", color: "#374151" }}>Created delegate OTP for Aiden</div>
              </div>
              <div style={{ padding: "1.1vh 1.5vw", display: "grid", gridTemplateColumns: "14vw 8vw 1fr", gap: "1vw", borderTop: "0.1vw solid #f1f5f9", backgroundColor: "#fafafa" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#1d1d1f" }}>attendant1</div>
                <div style={{ fontSize: "1.05vw", color: "#64748b" }}>11:48</div>
                <div style={{ fontSize: "1.05vw", color: "#374151" }}>Delegate OTP checkout — Aiden Okafor</div>
              </div>
              <div style={{ padding: "1.1vh 1.5vw", display: "grid", gridTemplateColumns: "14vw 8vw 1fr", gap: "1vw", borderTop: "0.1vw solid #f1f5f9" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#dc2626" }}>admin</div>
                <div style={{ fontSize: "1.05vw", color: "#64748b" }}>12:03</div>
                <div style={{ fontSize: "1.05vw", color: "#374151" }}>Logged emergency — medical alert, Class B</div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.2vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.45 }}>
              Access the Audit page from the sidebar. Logs cannot be deleted or edited — they are permanent.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Super Admin Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
