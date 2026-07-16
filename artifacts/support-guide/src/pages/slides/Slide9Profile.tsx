export default function Slide9Profile() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Your Profile</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left: what to fill in */}
        <div style={{ flex: "0 0 40vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
            Keep your profile up to date so admins can contact you and so your record reflects who you are on the team.
          </p>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Profile fields</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.6vw", padding: "1.2vh 1.2vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>Full Name</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151" }}>Your legal first and last name</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.6vw", padding: "1.2vh 1.2vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>Phone</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151" }}>Mobile number for contact</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.6vw", padding: "1.2vh 1.2vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>Date of Birth</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151" }}>Used for volunteer records</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.6vw", padding: "1.2vh 1.2vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>Photo URL</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#374151" }}>Helps admins identify you</div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.4vh 1.5vw" }}>
            <div style={{ fontSize: "1.05vw", fontWeight: 500, color: "#3730a3", marginBottom: "0.4vh" }}>How to access your profile</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.4 }}>Click your avatar in the top-right corner of any page to open your profile settings.</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: completeness + comms */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Profile completeness</div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.5vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.5, margin: "0 0 1.8vh 0" }}>
              A progress bar on your profile shows how complete your record is. Aim for 100%.
            </p>
            <div style={{ height: "1.5vh", backgroundColor: "#f1f5f9", borderRadius: "1vw", overflow: "hidden" }}>
              <div style={{ width: "72%", height: "100%", background: "linear-gradient(to right, #1e3a8a, #2563eb)", borderRadius: "1vw" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.6vh" }}>
              <div style={{ fontSize: "0.95vw", color: "#64748b" }}>72% complete</div>
              <div style={{ fontSize: "0.95vw", color: "#1e3a8a", fontWeight: 600 }}>Add phone + photo to reach 100%</div>
            </div>
          </div>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Communication preferences</div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "1.2vw", padding: "2.2vh 1.8vw", boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>In-app notifications</div>
              <div style={{ backgroundColor: "#dcfce7", color: "#15803d", fontSize: "0.9vw", fontWeight: 700, padding: "0.3vh 0.9vw", borderRadius: "2vw" }}>On</div>
            </div>
            <div style={{ width: "100%", height: "0.1vw", backgroundColor: "#f1f5f9" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>WhatsApp alerts</div>
              <div style={{ backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "0.9vw", fontWeight: 700, padding: "0.3vh 0.9vw", borderRadius: "2vw" }}>Off</div>
            </div>
            <div style={{ width: "100%", height: "0.1vw", backgroundColor: "#f1f5f9" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151" }}>SMS notifications</div>
              <div style={{ backgroundColor: "#f1f5f9", color: "#64748b", fontSize: "0.9vw", fontWeight: 700, padding: "0.3vh 0.9vw", borderRadius: "2vw" }}>Off</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Attendant Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
