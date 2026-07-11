export default function Slide9WhatsAppBot() {
  const abilities = [
    { emoji: "📍", label: "Live child status", desc: "In class · In transit · Picked up — real-time" },
    { emoji: "🔑", label: "Delegate OTP", desc: "Generate & share your pickup code instantly" },
    { emoji: "👶", label: "My children", desc: "See all registered children and their classes" },
    { emoji: "🔔", label: "Notifications", desc: "Read your latest alerts without opening the app" },
    { emoji: "📝", label: "Submit a concern", desc: "Safeguarding, complaint, or compliment" },
    { emoji: "🙋", label: "Request support", desc: "Check-in / check-out help from an attendant" },
  ];

  const smart = [
    { emoji: "🧠", label: "AI-powered", desc: "Just type what you need — no commands to memorise" },
    { emoji: "☀️", label: "Sunday reminders", desc: "Proactive alerts before the 7 am & 10:30 am services" },
    { emoji: "👥", label: "Multi-account", desc: "Parent + Teacher on the same phone number" },
    { emoji: "🔄", label: "Always available", desc: "Nudges you if you go quiet — type Yes to resume" },
  ];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#fafafa",
        fontFamily: "'Inter', sans-serif",
        color: "#1d1d1f",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "6vh 7vw",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#86868b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Shepherd Connect
        </div>
        <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#86868b" }}>
          WhatsApp Bot
        </div>
      </div>

      <div style={{ display: "flex", gap: "5vw", flex: 1, alignItems: "center" }}>
        <div style={{ flex: 1.1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2
            style={{
              fontSize: "4.2vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              margin: "0 0 1.5vh 0",
              lineHeight: 1.1,
            }}
          >
            Your church,{" "}
            <span style={{ color: "#1e3a8a", fontWeight: 600 }}>in your WhatsApp</span>
          </h2>
          <p
            style={{
              fontSize: "1.55vw",
              fontWeight: 300,
              color: "#86868b",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              marginBottom: "3vh",
            }}
          >
            Save <strong style={{ color: "#1d1d1f" }}>+2349012345678</strong> and text anything — the bot understands plain English.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5vh 2vw" }}>
            {abilities.map((a) => (
              <div key={a.label} style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                <div
                  style={{
                    width: "3vw",
                    height: "3vw",
                    backgroundColor: "#dbeafe",
                    borderRadius: "0.6vw",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3vw",
                    flexShrink: 0,
                  }}
                >
                  {a.emoji}
                </div>
                <div>
                  <div style={{ fontSize: "1.2vw", fontWeight: 600, marginBottom: "0.2vh" }}>{a.label}</div>
                  <div style={{ fontSize: "1vw", fontWeight: 300, color: "#86868b", lineHeight: 1.4 }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: "0 0 26vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div
            style={{
              backgroundColor: "#1e3a8a",
              borderRadius: "1.5vw",
              padding: "3.5vh 2.5vw",
            }}
          >
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2vh" }}>
              Smart features
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
              {smart.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: "0.8vw" }}>
                  <span style={{ fontSize: "1.2vw", flexShrink: 0 }}>{s.emoji}</span>
                  <div>
                    <div style={{ fontSize: "1.15vw", fontWeight: 600, color: "white", marginBottom: "0.2vh" }}>{s.label}</div>
                    <div style={{ fontSize: "0.95vw", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#fef3c7",
              borderRadius: "1.2vw",
              padding: "2.5vh 2vw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#92400e", marginBottom: "0.5vh" }}>Quick commands</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.8 }}>
              <strong>1</strong> Status · <strong>2</strong> OTP · <strong>3</strong> Children<br />
              <strong>4</strong> Notifications · <strong>5</strong> Concern · <strong>6</strong> Support<br />
              <strong>0</strong> Main menu · <strong>switch</strong> Change account
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>12</div>
      </div>
    </div>
  );
}
