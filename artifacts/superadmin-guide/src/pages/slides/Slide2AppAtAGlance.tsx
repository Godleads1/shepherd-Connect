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
            Super Admin Guide
          </div>
        </div>
        <div style={{ fontSize: "1.4vw", fontWeight: 300, color: "rgba(255,255,255,0.75)", letterSpacing: "-0.01em" }}>
          Your platform — at a glance
        </div>
      </div>

      {/* Platform modules grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: "1.2vw",
          padding: "2.5vh 4vw 2vh",
          overflow: "hidden",
        }}
      >
        {/* Families & Children */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#1e3a8a", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.9vw", marginTop: "0.5vh" }}>
            <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5vw", fontWeight: 800, color: "#f59e0b", flexShrink: 0 }}>F</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>Families &amp; Children</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Full family registry — contacts, emergency info</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Children's medical notes &amp; allergies</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Class assignments &amp; history</div>
          </div>
        </div>

        {/* Classes & Teachers */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#2563eb", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.9vw", marginTop: "0.5vh" }}>
            <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#2563eb", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5vw", fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>C</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>Classes &amp; Teachers</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Create &amp; manage age-group classes</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Allocate teachers; monitor ratios</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Review &amp; approve class-change requests</div>
          </div>
        </div>

        {/* Users & Approvals */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#f59e0b", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.9vw", marginTop: "0.5vh" }}>
            <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#f59e0b", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5vw", fontWeight: 800, color: "#1d1d1f", flexShrink: 0 }}>U</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>Users &amp; Approvals</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Approve pending admin &amp; teacher accounts</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Assign &amp; change user roles</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Activate or deactivate accounts</div>
          </div>
        </div>

        {/* Reports */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#16a34a", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.9vw", marginTop: "0.5vh" }}>
            <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#16a34a", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5vw", fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>R</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>Reports</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Attendance CSV export (date range)</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Not-picked-up live report</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Daily summary &amp; ratio alerts</div>
          </div>
        </div>

        {/* Emergencies */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#dc2626", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.9vw", marginTop: "0.5vh" }}>
            <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5vw", fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>!</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>Emergencies</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Log &amp; track incidents in real-time</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Export emergency log as CSV</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Full audit trail per incident</div>
          </div>
        </div>

        {/* Audit & Notifications */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.2vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#7c3aed", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.9vw", marginTop: "0.5vh" }}>
            <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#7c3aed", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5vw", fontWeight: 800, color: "#ffffff", flexShrink: 0 }}>A</div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>Audit &amp; Notifications</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Every action logged with timestamp</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Broadcast to specific roles</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Pre-dismissal parent alerts</div>
          </div>
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
          Shepherd Connect · Super Admin Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
