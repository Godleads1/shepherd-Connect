export default function Slide9ClassTeacherMgmt() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Classes, Teachers &amp; Sunday Setup</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "2.5vw", padding: "2.5vh 6vw 2vh", overflow: "hidden" }}>

        {/* Left column: Classes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.6vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Managing Classes</div>
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            {[
              'Go to Classes in the sidebar and tap "New Class"',
              "Set name and age range (e.g. Nursery 0\u20132, Primary 6\u20139)",
              "Assign children to the class via Class Assignments",
              "Review & approve class-change requests from parents or teachers",
            ].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
                <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#1e3a8a", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#f59e0b", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>{text}</div>
              </div>
            ))}
          </div>

          {/* Class Merges — new */}
          <div style={{ backgroundColor: "#fdf4ff", border: "0.1vw solid #e9d5ff", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 700, color: "#7e22ce", marginBottom: "0.5vh" }}>🔀 Class Merges</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 400, color: "#6b21a8", lineHeight: 1.45, marginBottom: "0.8vh" }}>
              When two classes share a room on a given Sunday, set up a merge in <strong>Settings → Class Merges</strong>. Choose the absorbed class, the host class, and the date.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
              <div style={{ fontSize: "0.9vw", color: "#7e22ce", lineHeight: 1.4 }}>• Pickup notifications for absorbed-class children route to host teachers</div>
              <div style={{ fontSize: "0.9vw", color: "#7e22ce", lineHeight: 1.4 }}>• Message reads: "Sofia is on her way — from Age 1, merged with Age 2 today"</div>
              <div style={{ fontSize: "0.9vw", color: "#7e22ce", lineHeight: 1.4 }}>• Merge is date-specific and can be removed at any time</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Middle column: Teacher allocations */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.6vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Teacher Allocations</div>
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            {[
              "Go to Teacher Allocations in the sidebar",
              "Select a teacher and assign them to one or more classes",
              "Teacher sees their assigned class immediately on next login",
              "Monitor ratios on the Reports page — add teachers if alerts appear",
            ].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
                <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#2563eb", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>{text}</div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#3730a3", marginBottom: "0.4vh" }}>Class Change Requests</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.4 }}>When approved, the child is automatically moved to the new class with no manual step needed.</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right column: Sunday Setup (Hall Sessions) — new */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.6vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Sunday Setup</div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Hall Session Toggle</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>
              When the whole congregation worships together before classes split, support activates a <strong>Hall Session</strong> in Settings → Sunday Setup.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
              {[
                'En-route parent messages say "Sofia is in the general hall \u2014 heading to class after the session"',
                "Teacher notifications hold until children are dispatched from the hall",
                'Tap "Praise is done \u2014 send all to class" to dispatch everyone at once',
                "Hall session clears automatically after bulk dispatch",
              ].map((text, i) => (
                <div key={i} style={{ display: "flex", gap: "0.7vw", alignItems: "flex-start" }}>
                  <div style={{ width: "1.4vw", height: "1.4vw", backgroundColor: "#f3f4f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75vw", fontWeight: 700, color: "#6b7280", flexShrink: 0, marginTop: "0.1vh" }}>{i + 1}</div>
                  <div style={{ fontSize: "0.9vw", color: "#374151", lineHeight: 1.4 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: "#f0fdf4", border: "0.1vw solid #bbf7d0", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#166534", marginBottom: "0.4vh" }}>Who can configure this?</div>
            <div style={{ fontSize: "0.9vw", fontWeight: 400, color: "#14532d", lineHeight: 1.4 }}>
              Class Merges and Hall Session toggles are available to <strong>Admins</strong> and <strong>Super Admins</strong> in Settings. Support staff can activate/deactivate the Hall Session toggle on the day.
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Super Admin Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
