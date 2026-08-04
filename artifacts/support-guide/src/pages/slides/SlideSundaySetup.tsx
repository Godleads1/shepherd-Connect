export default function SlideSundaySetup() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Sunday Setup</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Support Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left: Hall Session */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Hall Session</div>

          <p style={{ fontSize: "1.1vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
            On Sundays when the whole congregation worships together before classes split, activate a Hall Session so parents receive accurate location messages.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3vw", height: "3vw", background: "linear-gradient(135deg,#4c1d95,#7c3aed)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "1.1vw", fontWeight: 800, color: "#fff" }}>1</span>
              </div>
              <div>
                <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Go to Settings → Sunday Setup</div>
                <div style={{ fontSize: "1vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Available before service starts. Select the correct service slot (or "Both").</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3vw", height: "3vw", background: "linear-gradient(135deg,#4c1d95,#7c3aed)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "1.1vw", fontWeight: 800, color: "#fff" }}>2</span>
              </div>
              <div>
                <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Tap "Activate Hall Session"</div>
                <div style={{ fontSize: "1vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>A purple banner now appears on the Check-In page. Parents get hall-specific en-route messages.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3vw", height: "3vw", background: "linear-gradient(135deg,#4c1d95,#7c3aed)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "1.1vw", fontWeight: 800, color: "#fff" }}>3</span>
              </div>
              <div>
                <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>When praise ends — dispatch all children</div>
                <div style={{ fontSize: "1vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Tap <strong>"Praise is done — send all to class"</strong> on the Check-In page. Every checked-in child is sent to their class simultaneously. Parents and teachers are all notified.</div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fdf4ff", border: "0.1vw solid #e9d5ff", borderRadius: "0.8vw", padding: "1.4vh 1.5vw", marginTop: "auto" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#7e22ce", marginBottom: "0.4vh" }}>Hall session auto-clears</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 400, color: "#6b21a8", lineHeight: 1.4 }}>After dispatch, the hall session is removed automatically. Any children who check in after praise ends will receive the normal escort message.</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: Bulk Dispatch + Class Merges awareness */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bulk Dispatch &amp; Class Merges</div>

          {/* Bulk dispatch flow */}
          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "1.2vh" }}>What happens when you tap "Send All to Class"</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              {[
                { icon: "👶", label: "All dropped-off children", desc: "transition to In Transit in one action — no tapping each child individually" },
                { icon: "📱", label: "Every parent notified instantly", desc: "their child is being escorted to class right now" },
                { icon: "🍎", label: "Every teacher notified instantly", desc: "which children are on their way and from which class (if merged)" },
                { icon: "✅", label: "Hall session cleared automatically", desc: "so future escort messages revert to normal wording" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "1vw", alignItems: "flex-start" }}>
                  <div style={{ fontSize: "1.3vw", flexShrink: 0, marginTop: "0.1vh" }}>{item.icon}</div>
                  <div>
                    <span style={{ fontSize: "0.95vw", fontWeight: 600, color: "#1d1d1f" }}>{item.label} — </span>
                    <span style={{ fontSize: "0.95vw", fontWeight: 400, color: "#64748b" }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Class merge awareness */}
          <div style={{ backgroundColor: "#fdf4ff", border: "0.1vw solid #e9d5ff", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#7e22ce", marginBottom: "0.5vh" }}>🔀 Class Merges — what you see</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 400, color: "#6b21a8", lineHeight: 1.5 }}>
              If an admin has set up a class merge today (e.g. Age 1 absorbed into Age 2's room), pickup notifications for Age 1 children will route to Age 2's teachers automatically. You don't need to do anything differently — the system handles the routing.
            </div>
          </div>

          <div style={{ backgroundColor: "#fff7ed", border: "0.1vw solid #fed7aa", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#92400e", marginBottom: "0.4vh" }}>Only available to Support &amp; above</div>
            <div style={{ fontSize: "0.95vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>Attendants do not see the Sunday Setup menu. If a hall session needs activating, contact a support staff member.</div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Support Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
