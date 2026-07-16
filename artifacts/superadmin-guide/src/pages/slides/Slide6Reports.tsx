export default function Slide6Reports() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Reports &amp; Analytics</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "2.5vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left: 3 report types stacked */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Available reports</div>

          {/* Attendance CSV */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1vh", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#1e3a8a", borderRadius: "1.2vw 1.2vw 0 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.6vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f" }}>Attendance Export</div>
              <div style={{ backgroundColor: "#dbeafe", color: "#1e40af", fontSize: "0.85vw", fontWeight: 600, padding: "0.3vh 0.9vw", borderRadius: "2vw" }}>CSV</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Download attendance records for any date range. Filter by class. Contains child name, date, status, and teacher.</div>
          </div>

          {/* Not-picked-up */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1vh", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#dc2626", borderRadius: "1.2vw 1.2vw 0 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.6vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f" }}>Not-Picked-Up</div>
              <div style={{ backgroundColor: "#fee2e2", color: "#dc2626", fontSize: "0.85vw", fontWeight: 600, padding: "0.3vh 0.9vw", borderRadius: "2vw" }}>Live</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Real-time list of all checked-in children still present. Shows parent phone numbers for immediate contact.</div>
          </div>

          {/* Emergency log */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1vh", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#7c3aed", borderRadius: "1.2vw 1.2vw 0 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.6vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f" }}>Emergency Log Export</div>
              <div style={{ backgroundColor: "#ede9fe", color: "#7c3aed", fontSize: "0.85vw", fontWeight: 600, padding: "0.3vh 0.9vw", borderRadius: "2vw" }}>CSV</div>
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Download full incident log. Useful for safeguarding reviews and insurance reporting.</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: Daily summary + ratio */}
        <div style={{ flex: "0 0 36vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Dashboard cards</div>

          {/* Daily Summary */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "1.5vh" }}>Today's Summary Card</div>
            <div style={{ display: "flex", gap: "1.5vw" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.5vw", fontWeight: 800, color: "#1e3a8a", lineHeight: 1 }}>24</div>
                <div style={{ fontSize: "0.95vw", fontWeight: 500, color: "#64748b", marginTop: "0.5vh" }}>Checked In</div>
              </div>
              <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0" }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.5vw", fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}>18</div>
                <div style={{ fontSize: "0.95vw", fontWeight: 500, color: "#64748b", marginTop: "0.5vh" }}>Still Present</div>
              </div>
              <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0" }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.5vw", fontWeight: 800, color: "#16a34a", lineHeight: 1 }}>6</div>
                <div style={{ fontSize: "0.95vw", fontWeight: 500, color: "#64748b", marginTop: "0.5vh" }}>Picked Up</div>
              </div>
            </div>
          </div>

          {/* Teacher ratio */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.5vh" }}>Teacher-to-Child Ratio</div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", marginBottom: "1.5vh", lineHeight: 1.4 }}>The Reports page flags classes where ratios fall below safe thresholds.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8vh 1vw", backgroundColor: "#dcfce7", borderRadius: "0.6vw" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#15803d" }}>Nursery (0-2)</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#15803d" }}>1 : 3 — Good</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8vh 1vw", backgroundColor: "#dcfce7", borderRadius: "0.6vw" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#15803d" }}>Beginners (3-5)</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#15803d" }}>1 : 5 — Good</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8vh 1vw", backgroundColor: "#fee2e2", borderRadius: "0.6vw" }}>
                <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#dc2626" }}>Primary (6-9)</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#dc2626" }}>1 : 14 — Alert</div>
              </div>
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
