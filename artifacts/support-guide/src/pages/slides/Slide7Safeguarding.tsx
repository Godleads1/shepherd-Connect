export default function Slide7Safeguarding() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#0d1f4a",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "50vw", height: "50vh", background: "radial-gradient(ellipse at 90% 90%, rgba(30,58,138,0.5) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ backgroundColor: "rgba(255,255,255,0.05)", borderBottom: "0.1vw solid rgba(255,255,255,0.1)", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Safeguarding at the Kiosk</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden", position: "relative" }}>

        {/* Left */}
        <div style={{ flex: "0 0 42vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, margin: 0 }}>
            As an attendant, you are the last safeguarding gate before a child leaves the building. These rules are non-negotiable.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ backgroundColor: "rgba(220,38,38,0.18)", border: "0.1vw solid rgba(220,38,38,0.4)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", backgroundColor: "#dc2626", borderRadius: "0.3vw", flexShrink: 0, alignSelf: "stretch" }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#fca5a5", marginBottom: "0.3vh" }}>No child leaves without a confirmed adult</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Every child must be collected by a verified parent or valid OTP delegate. No exceptions.</div>
              </div>
            </div>

            <div style={{ backgroundColor: "rgba(220,38,38,0.18)", border: "0.1vw solid rgba(220,38,38,0.4)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", backgroundColor: "#dc2626", borderRadius: "0.3vw", flexShrink: 0, alignSelf: "stretch" }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#fca5a5", marginBottom: "0.3vh" }}>If in doubt — hold and call admin</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>You will never be blamed for being cautious. You will be held responsible for releasing to an unverified person.</div>
              </div>
            </div>

            <div style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "0.1vw solid rgba(245,158,11,0.25)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "0.3vw", flexShrink: 0, alignSelf: "stretch" }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#fde68a", marginBottom: "0.3vh" }}>Do not accept verbal permission</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>A parent calling to say "my friend is coming" is not sufficient. The delegate must have a valid OTP in the app.</div>
              </div>
            </div>

            <div style={{ backgroundColor: "rgba(30,58,138,0.4)", border: "0.1vw solid rgba(30,58,138,0.6)", borderRadius: "0.8vw", padding: "1.5vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
              <div style={{ width: "0.5vw", backgroundColor: "#93c5fd", borderRadius: "0.3vw", flexShrink: 0, alignSelf: "stretch" }} />
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#93c5fd", marginBottom: "0.3vh" }}>Suspicious behaviour — report immediately</div>
                <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>If someone is pressuring you, acting unusually, or you feel unsafe — alert an admin and log an emergency incident.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

        {/* Right: escalation contacts */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh", position: "relative" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>When to escalate</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.1)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.4vh" }}>Unknown adult claims to know parent</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>Hold the child, call admin</div>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.1)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.4vh" }}>Child upset or refuses to leave</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>Do not force. Call an admin immediately</div>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.1)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.4vh" }}>Two adults both claim the child</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>Do not take sides. Hold the child and escalate to pastor or admin</div>
            </div>
            <div style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.1)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.4vh" }}>Child discloses abuse or harm</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>Listen, do not question. Log an emergency incident. Inform the lead pastor</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "0.1vw solid rgba(255,255,255,0.08)", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>Shepherd Connect · Attendant Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.35)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
