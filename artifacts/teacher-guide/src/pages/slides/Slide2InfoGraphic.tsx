export default function Slide2InfoGraphic() {
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
            Teacher Guide
          </div>
        </div>
        <div style={{ fontSize: "1.4vw", fontWeight: 300, color: "rgba(255,255,255,0.75)", letterSpacing: "-0.01em" }}>
          Your tools — at a glance
        </div>
      </div>

      {/* Sunday workflow */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "2vh 4vw 1.8vh",
          borderBottom: "0.15vw solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.8vh" }}>
          Your Sunday workflow
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Step 1 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4vw", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">📲</span>
            </div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Clock In</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "8vw" }}>Arrive &amp; log presence</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "2.5vh" }}>→</div>
          {/* Step 2 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#2563eb", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4vw", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">👶</span>
            </div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>My Class</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "8vw" }}>View who is checked in</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "2.5vh" }}>→</div>
          {/* Step 3 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4vw", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">📋</span>
            </div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Attendance</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "8vw" }}>Confirm each child present</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "2.5vh" }}>→</div>
          {/* Step 4 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4vw", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">✏️</span>
            </div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Teach &amp; Appraise</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "8vw" }}>Write child reports</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "2.5vh" }}>→</div>
          {/* Step 5 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#d97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4vw", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">🚶</span>
            </div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Escort</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "8vw" }}>Walk children to parents</div>
          </div>
          <div style={{ fontSize: "1.8vw", color: "#cbd5e1", fontWeight: 300, flexShrink: 0, marginBottom: "2.5vh" }}>→</div>
          {/* Step 6 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "6vw", height: "6vw", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4vw", marginBottom: "1vh", boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">✅</span>
            </div>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh", lineHeight: 1.2 }}>Clock Out</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "8vw" }}>Log end of session</div>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1.2vw",
          padding: "2vh 4vw 2vh",
          overflow: "hidden",
        }}
      >
        {/* My Class */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#1e3a8a", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.8vw", marginTop: "0.8vh" }}>
            <div style={{ width: "3vw", height: "3vw", backgroundColor: "#1e3a8a", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">🏫</span>
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f" }}>My Class</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#1e3a8a18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>1</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>See all assigned children</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#1e3a8a18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>2</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>View allergy &amp; medical notes</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#1e3a8a18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>3</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Track check-in status live</div>
            </div>
          </div>
        </div>

        {/* Attendance */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#2563eb", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.8vw", marginTop: "0.8vh" }}>
            <div style={{ width: "3vw", height: "3vw", backgroundColor: "#2563eb", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">📋</span>
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f" }}>Attendance</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#2563eb18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>1</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Mark Present / Absent</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#2563eb18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>2</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Set status to "In Transit"</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#2563eb18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>3</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Notifies parents live</div>
            </div>
          </div>
        </div>

        {/* Appraisals */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#f59e0b", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.8vw", marginTop: "0.8vh" }}>
            <div style={{ width: "3vw", height: "3vw", backgroundColor: "#f59e0b", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">✏️</span>
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f" }}>Appraisals</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#f59e0b18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>1</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Select child → New Appraisal</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#f59e0b18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>2</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Rate behaviour &amp; participation</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#f59e0b18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>3</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Add notes — visible to admin</div>
            </div>
          </div>
        </div>

        {/* Class Change */}
        <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", display: "flex", flexDirection: "column", gap: "1.1vh", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#7c3aed", borderRadius: "1.2vw 1.2vw 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.8vw", marginTop: "0.8vh" }}>
            <div style={{ width: "3vw", height: "3vw", backgroundColor: "#7c3aed", borderRadius: "0.6vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", flexShrink: 0 }}>
              <span role="img" aria-hidden="true">🔄</span>
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 700, color: "#1d1d1f" }}>Class Changes</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#7c3aed18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>1</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Submit request with reason</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#7c3aed18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>2</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Admin reviews &amp; approves</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6vw" }}>
              <div style={{ width: "1.6vw", height: "1.6vw", backgroundColor: "#7c3aed18", borderRadius: "0.3vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85vw", flexShrink: 0, marginTop: "0.1vh" }}>3</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Child moved automatically</div>
            </div>
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
          Shepherd Connect · Teacher Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
