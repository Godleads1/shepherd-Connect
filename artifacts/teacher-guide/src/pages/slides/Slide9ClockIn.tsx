export default function Slide9ClockIn() {
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
        boxSizing: "border-box",
      }}
    >
      {/* Top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.8vh", backgroundColor: "#1e3a8a" }} />

      {/* Left — content */}
      <div
        style={{
          flex: "0 0 50vw",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "6vh 4vw 6vh 7vw",
          boxSizing: "border-box",
        }}
      >
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
            marginBottom: "2.5vh",
            width: "fit-content",
          }}
        >
          Module 6
        </div>
        <h2
          style={{
            fontSize: "5.5vw",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#1e3a8a",
            margin: "0 0 2.5vh 0",
            lineHeight: 1.08,
          }}
        >
          Clock In / Out
        </h2>
        <p
          style={{
            fontSize: "1.6vw",
            fontWeight: 300,
            color: "#64748b",
            lineHeight: 1.55,
            marginBottom: "4vh",
          }}
        >
          Log your arrival and departure every Sunday. This feeds into staffing records and teacher-to-child ratio reports.
        </p>

        <div style={{ display: "flex", gap: "2vw", marginBottom: "3.5vh" }}>
          {/* Clock In card */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#f0fdf4",
              border: "0.15vw solid #bbf7d0",
              borderRadius: "1vw",
              padding: "2.2vh 2vw",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "0.8vh",
            }}
          >
            <div style={{ fontSize: "2.8vw" }}>
              <span role="img" aria-hidden="true">🟢</span>
            </div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#166534" }}>Clock In</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#14532d", lineHeight: 1.4 }}>
              Tap when you arrive — before class begins
            </div>
          </div>

          {/* Clock Out card */}
          <div
            style={{
              flex: 1,
              backgroundColor: "#fef2f2",
              border: "0.15vw solid #fecaca",
              borderRadius: "1vw",
              padding: "2.2vh 2vw",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "0.8vh",
            }}
          >
            <div style={{ fontSize: "2.8vw" }}>
              <span role="img" aria-hidden="true">🔴</span>
            </div>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#991b1b" }}>Clock Out</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#7f1d1d", lineHeight: 1.4 }}>
              Tap when all children are picked up
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#fef3c7",
            border: "0.15vw solid #f59e0b",
            borderRadius: "0.8vw",
            padding: "1.8vh 1.8vw",
            display: "flex",
            gap: "1vw",
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: "1.6vw", flexShrink: 0 }}>
            <span role="img" aria-hidden="true">💡</span>
          </div>
          <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>
            Admin uses your clock-in data to monitor teacher coverage. An under-staffed class triggers an alert to the coordinator.
          </div>
        </div>
      </div>

      {/* Right — visual timeline */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "5vh 6vw",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "0.1vw solid #e2e8f0",
            borderRadius: "1.5vw",
            padding: "3vh 3vw",
            width: "100%",
            boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "2.5vh" }}>Today's Session</div>

          {/* Timeline events */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
            {/* Clock in */}
            <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
              <div style={{ width: "6vw", textAlign: "right", fontSize: "1.15vw", fontWeight: 600, color: "#1e3a8a", flexShrink: 0 }}>9:00 AM</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#16a34a", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ width: "0.2vw", height: "4vh", backgroundColor: "#e2e8f0" }} />
              </div>
              <div style={{ flex: 1, backgroundColor: "#f0fdf4", border: "0.1vw solid #bbf7d0", borderRadius: "0.6vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#166534" }}>Clocked In</div>
                <div style={{ fontSize: "0.95vw", color: "#4ade80" }}>Session started</div>
              </div>
            </div>

            {/* Class begins */}
            <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
              <div style={{ width: "6vw", textAlign: "right", fontSize: "1.15vw", fontWeight: 600, color: "#64748b", flexShrink: 0 }}>9:30 AM</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ width: "0.2vw", height: "4vh", backgroundColor: "#e2e8f0" }} />
              </div>
              <div style={{ flex: 1, backgroundColor: "#f8fafc", border: "0.1vw solid #e2e8f0", borderRadius: "0.6vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#1e3a8a" }}>Attendance Submitted</div>
                <div style={{ fontSize: "0.95vw", color: "#94a3b8" }}>4 present, 1 absent</div>
              </div>
            </div>

            {/* Escort */}
            <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
              <div style={{ width: "6vw", textAlign: "right", fontSize: "1.15vw", fontWeight: 600, color: "#64748b", flexShrink: 0 }}>12:30 PM</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#d97706", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ width: "0.2vw", height: "4vh", backgroundColor: "#e2e8f0" }} />
              </div>
              <div style={{ flex: 1, backgroundColor: "#fff7ed", border: "0.1vw solid #fed7aa", borderRadius: "0.6vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#92400e" }}>Children In Transit</div>
                <div style={{ fontSize: "0.95vw", color: "#b45309" }}>Escorting to collection point</div>
              </div>
            </div>

            {/* Clock out */}
            <div style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
              <div style={{ width: "6vw", textAlign: "right", fontSize: "1.15vw", fontWeight: 600, color: "#991b1b", flexShrink: 0 }}>1:00 PM</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: "1.2vw", height: "1.2vw", backgroundColor: "#dc2626", borderRadius: "50%", flexShrink: 0 }} />
              </div>
              <div style={{ flex: 1, backgroundColor: "#fef2f2", border: "0.1vw solid #fecaca", borderRadius: "0.6vw", padding: "1.2vh 1.2vw" }}>
                <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#991b1b" }}>Clocked Out</div>
                <div style={{ fontSize: "0.95vw", color: "#f87171" }}>Session complete</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#1e3a8a",
          padding: "1.2vh 7vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
