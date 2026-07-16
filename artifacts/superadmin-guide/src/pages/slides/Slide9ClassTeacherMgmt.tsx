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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Classes &amp; Teacher Allocations</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left column: Classes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Managing Classes</div>
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.5vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#1e3a8a", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#f59e0b", flexShrink: 0 }}>1</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Go to Classes in the sidebar and tap "New Class"</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#1e3a8a", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#f59e0b", flexShrink: 0 }}>2</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Set name and age range (e.g. Nursery 0–2, Primary 6–9)</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#1e3a8a", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#f59e0b", flexShrink: 0 }}>3</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Assign children to the class via Class Assignments</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#1e3a8a", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#f59e0b", flexShrink: 0 }}>4</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Review &amp; approve class-change requests from parents or teachers</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#3730a3", marginBottom: "0.4vh" }}>Class Change Requests</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.4 }}>When approved, the child is automatically moved to the new class with no manual step needed.</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right column: Teacher allocations */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Teacher Allocations</div>
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.5vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#2563eb", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>1</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Go to Teacher Allocations in the sidebar</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#2563eb", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>2</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Select a teacher and assign them to one or more classes</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#2563eb", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>3</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Teacher sees their assigned class immediately on next login</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}>
              <div style={{ width: "1.8vw", height: "1.8vw", backgroundColor: "#2563eb", borderRadius: "0.4vw", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95vw", fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>4</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.45 }}>Monitor ratios on the Reports page — add teachers if alerts appear</div>
            </div>
          </div>

          {/* Sample classes table */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1vw", overflow: "hidden", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
            <div style={{ backgroundColor: "#f1f5f9", padding: "0.9vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 8vw 8vw" }}>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Class</div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Children</div>
              <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Teachers</div>
            </div>
            <div style={{ padding: "0.9vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 8vw 8vw", borderTop: "0.1vw solid #f1f5f9" }}>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>Nursery (0–2)</div>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>9</div>
              <div style={{ fontSize: "1.05vw", color: "#16a34a", fontWeight: 600 }}>3</div>
            </div>
            <div style={{ padding: "0.9vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 8vw 8vw", borderTop: "0.1vw solid #f1f5f9", backgroundColor: "#fafafa" }}>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>Beginners (3–5)</div>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>12</div>
              <div style={{ fontSize: "1.05vw", color: "#16a34a", fontWeight: 600 }}>2</div>
            </div>
            <div style={{ padding: "0.9vh 1.5vw", display: "grid", gridTemplateColumns: "1fr 8vw 8vw", borderTop: "0.1vw solid #f1f5f9" }}>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>Primary (6–9)</div>
              <div style={{ fontSize: "1.05vw", color: "#374151" }}>14</div>
              <div style={{ fontSize: "1.05vw", color: "#dc2626", fontWeight: 600 }}>1</div>
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
