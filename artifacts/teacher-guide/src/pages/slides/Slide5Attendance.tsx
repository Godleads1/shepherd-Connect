export default function Slide5Attendance() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#fafafa",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Top accent */}
      <div style={{ height: "0.8vh", backgroundColor: "#1e3a8a", flexShrink: 0 }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "4vh 7vw 3vh", boxSizing: "border-box" }}>
        {/* Heading */}
        <div style={{ marginBottom: "3.5vh" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#1e3a8a",
              color: "#f59e0b",
              fontSize: "0.85vw",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0.4vh 1vw",
              borderRadius: "0.3vw",
              marginBottom: "2vh",
            }}
          >
            Module 2
          </div>
          <h2
            style={{
              fontSize: "5vw",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#1e3a8a",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Attendance &amp; Escorting
          </h2>
        </div>

        {/* Two-column layout */}
        <div style={{ flex: 1, display: "flex", gap: "4vw" }}>
          {/* Left — Attendance flow */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2vh" }}>
              Marking Attendance
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.8vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>1</div>
                <div>
                  <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.4vh" }}>Open Attendance</div>
                  <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Go to Attendance in the menu — your class is pre-loaded</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.8vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>2</div>
                <div>
                  <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.4vh" }}>Mark each child</div>
                  <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Tap <strong>Present</strong> or <strong>Absent</strong> for each child in your roster</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.8vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>3</div>
                <div>
                  <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.4vh" }}>Submit attendance</div>
                  <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Confirm — parents of absent children are notified automatically</div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

          {/* Right — Escort flow + bulk arrive */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>
              Escorting &amp; Confirming Arrivals
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
              <div style={{ backgroundColor: "#fff7ed", border: "0.1vw solid #fed7aa", borderRadius: "0.8vw", padding: "1.5vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "#d97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>A</div>
                <div>
                  <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#92400e", marginBottom: "0.3vh" }}>Mark "In Transit"</div>
                  <div style={{ fontSize: "1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>Set child status to In Transit before leaving the class</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#fff7ed", border: "0.1vw solid #fed7aa", borderRadius: "0.8vw", padding: "1.5vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "#d97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>B</div>
                <div>
                  <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#92400e", marginBottom: "0.3vh" }}>Walk child to collection point</div>
                  <div style={{ fontSize: "1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>The parent receives a push notification the moment you tap In Transit</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#f0fdf4", border: "0.1vw solid #bbf7d0", borderRadius: "0.8vw", padding: "1.5vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>C</div>
                <div>
                  <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#166534", marginBottom: "0.3vh" }}>Confirm arrival — tap "Confirm in Class"</div>
                  <div style={{ fontSize: "1vw", fontWeight: 400, color: "#14532d", lineHeight: 1.4 }}>When a child arrives at your room, tap this button. Parent is notified and the record is complete.</div>
                </div>
              </div>

              {/* Bulk arrive — new */}
              <div style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)", borderRadius: "0.8vw", padding: "1.5vh 1.8vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
                <div style={{ width: "2.8vw", height: "2.8vw", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3vw", fontWeight: 700, color: "#f59e0b", flexShrink: 0 }}>D</div>
                <div>
                  <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>After a hall session — "Mark all arrived" in one tap</div>
                  <div style={{ fontSize: "1vw", fontWeight: 400, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>When support dispatches all children from the hall at once, 2 or more children arrive in transit simultaneously. Tap the blue <strong>"Mark all arrived"</strong> button on your My Class page to confirm everyone in a single action.</div>
                </div>
              </div>

              {/* Class merge note — new */}
              <div style={{ backgroundColor: "#fdf4ff", border: "0.1vw solid #e9d5ff", borderRadius: "0.8vw", padding: "1.2vh 1.5vw" }}>
                <div style={{ fontSize: "0.95vw", fontWeight: 700, color: "#7e22ce", marginBottom: "0.3vh" }}>🔀 Receiving merged classes</div>
                <div style={{ fontSize: "0.9vw", fontWeight: 400, color: "#6b21a8", lineHeight: 1.4 }}>If another class has merged into yours today, you'll receive escort notifications for those children too. The message shows their original class name so you know who they are.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#1e3a8a",
          padding: "1.2vh 7vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)" }}>
          Shepherd Connect · Teacher Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
