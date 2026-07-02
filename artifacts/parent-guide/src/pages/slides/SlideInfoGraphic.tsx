export default function SlideInfoGraphic() {
  const steps = [
    { icon: "📋", label: "Register", sub: "Sign up at church or online", color: "#1e3a8a", light: "#dbeafe", text: "#fff" },
    { icon: "👶", label: "Add Children", sub: "Name, class & allergies", color: "#2563eb", light: "#eff6ff", text: "#fff" },
    { icon: "📱", label: "QR Check-In", sub: "Scan at the kiosk", color: "#1e3a8a", light: "#dbeafe", text: "#fff" },
    { icon: "🏫", label: "In Class", sub: "Learning & celebrated", color: "#f59e0b", light: "#fef3c7", text: "#1d1d1f" },
    { icon: "🚶", label: "In Transit", sub: "Teacher escorts them", color: "#d97706", light: "#fde68a", text: "#1d1d1f" },
    { icon: "✅", label: "Picked Up", sub: "Safely checked out", color: "#16a34a", light: "#dcfce7", text: "#fff" },
  ];

  const features = [
    {
      icon: "👥",
      color: "#1e3a8a",
      title: "Delegate Pickup",
      items: [
        { dot: "🔵", text: "Add a trusted person" },
        { dot: "🔢", text: "Get a 6-digit OTP" },
        { dot: "📤", text: "Share OTP with them" },
        { dot: "✓",  text: "They present it at kiosk" },
      ],
    },
    {
      icon: "📝",
      color: "#7c3aed",
      title: "Class Change Request",
      items: [
        { dot: "📌", text: "Open My Family → child" },
        { dot: "✏️", text: "Choose new class + reason" },
        { dot: "👍", text: "Admin reviews & approves" },
        { dot: "🏫", text: "Child auto-moved instantly" },
      ],
    },
    {
      icon: "💬",
      color: "#25d366",
      title: "WhatsApp Bot",
      items: [
        { dot: "📍", text: "\"Where is my child?\"" },
        { dot: "🔑", text: "\"Generate my OTP\"" },
        { dot: "🔔", text: "\"Show my notifications\"" },
        { dot: "☀️", text: "Sunday service reminders" },
      ],
      note: "Save +2349012345678 · text anything",
    },
    {
      icon: "🔔",
      color: "#dc2626",
      title: "Real-time Alerts",
      items: [
        { dot: "✓",  text: "Child checked in" },
        { dot: "→",  text: "Teacher heading to you" },
        { dot: "✓✓", text: "Pickup confirmed" },
        { dot: "📢", text: "Church broadcasts" },
      ],
    },
  ];

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
          padding: "2.2vh 6vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
          <div style={{ fontSize: "2.2vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.03em" }}>
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
            Parent Guide
          </div>
        </div>
        <div style={{ fontSize: "1.5vw", fontWeight: 300, color: "rgba(255,255,255,0.75)", letterSpacing: "-0.01em" }}>
          Everything you need to know — at a glance
        </div>
      </div>

      {/* Journey section */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "2.5vh 4vw 2vh",
          borderBottom: "0.15vw solid #e2e8f0",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2vh" }}>
          Your child's Sunday journey
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {steps.map((step, i) => (
            <div key={step.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                {/* Icon circle */}
                <div
                  style={{
                    width: "6.5vw",
                    height: "6.5vw",
                    backgroundColor: step.color,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2.6vw",
                    marginBottom: "1.2vh",
                    boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.12)",
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "0.4vh", lineHeight: 1.2 }}>
                  {step.label}
                </div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "#64748b", lineHeight: 1.3, maxWidth: "9vw" }}>
                  {step.sub}
                </div>
              </div>
              {/* Arrow connector */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    fontSize: "2vw",
                    color: "#cbd5e1",
                    fontWeight: 300,
                    flexShrink: 0,
                    marginBottom: "3vh",
                    marginLeft: "-0.5vw",
                    marginRight: "-0.5vw",
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1.2vw",
          padding: "2vh 4vw 2.5vh",
          overflow: "hidden",
        }}
      >
        {features.map((feat) => (
          <div
            key={feat.title}
            style={{
              backgroundColor: "#ffffff",
              border: "0.1vw solid #e2e8f0",
              borderRadius: "1.2vw",
              padding: "2.2vh 2vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.2vh",
              boxShadow: "0 0.2vw 0.8vw rgba(0,0,0,0.05)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Color accent strip */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "0.5vh",
                backgroundColor: feat.color,
                borderRadius: "1.2vw 1.2vw 0 0",
              }}
            />
            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.8vw", marginTop: "0.8vh" }}>
              <div
                style={{
                  width: "3.2vw",
                  height: "3.2vw",
                  backgroundColor: feat.color,
                  borderRadius: "0.6vw",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5vw",
                  flexShrink: 0,
                }}
              >
                {feat.icon}
              </div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f", lineHeight: 1.2 }}>
                {feat.title}
              </div>
            </div>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9vh" }}>
              {feat.items.map((item) => (
                <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: "0.7vw" }}>
                  <div
                    style={{
                      width: "1.8vw",
                      height: "1.8vw",
                      backgroundColor: feat.color + "18",
                      borderRadius: "0.3vw",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.9vw",
                      flexShrink: 0,
                      marginTop: "0.1vh",
                    }}
                  >
                    {item.dot}
                  </div>
                  <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>
                    {item.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Note (e.g. WhatsApp number) */}
            {feat.note && (
              <div
                style={{
                  marginTop: "0.5vh",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "0.5vw",
                  padding: "0.8vh 0.8vw",
                  fontSize: "0.95vw",
                  fontWeight: 600,
                  color: "#15803d",
                  textAlign: "center",
                }}
              >
                {feat.note}
              </div>
            )}
          </div>
        ))}
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
          Shepherd Connect · Parent Guide · 2026
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "3vw" }}>
          <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
            🌐 shepherdconnect.church
          </div>
          <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
            💬 +2349012345678
          </div>
          <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
            📧 admin@shepherd.com
          </div>
        </div>
      </div>
    </div>
  );
}
