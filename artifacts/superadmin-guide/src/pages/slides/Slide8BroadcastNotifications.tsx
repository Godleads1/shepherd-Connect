export default function Slide8BroadcastNotifications() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Broadcast Notifications</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left: how to broadcast */}
        <div style={{ flex: "0 0 40vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
            Send an in-app notification to one or more roles simultaneously. Messages appear in each user's Notifications page immediately.
          </p>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Steps to broadcast</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Go to Notifications</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Open the Notifications section from the sidebar navigation</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Select target roles</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Choose from admin, teacher, attendant, or parent — or all roles at once</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Write and send</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Enter your message and click Broadcast — delivered instantly to all matching users</div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: use cases */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.8vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Common use cases</div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh" }}>Pre-dismissal alert</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Notify all parents of currently checked-in children that service is ending and children are ready for collection.</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh" }}>Teacher briefing</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Send a message to all teachers before the session — venue change, curriculum note, or safety reminder.</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh" }}>All-staff alert</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Broadcast to all roles simultaneously for urgent platform or venue announcements.</div>
          </div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.3vh" }}>Parent update</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>Share upcoming event dates, registration deadlines, or general ministry news with all parents.</div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.2vh 1.5vw", marginTop: "auto" }}>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.45 }}>
              Recipients see the message in their Notifications inbox, with sender name and timestamp.
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
