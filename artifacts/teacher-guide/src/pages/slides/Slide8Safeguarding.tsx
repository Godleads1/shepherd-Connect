export default function Slide8Safeguarding() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#0f172a",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.12) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "5vh 7vw 3vh", boxSizing: "border-box", position: "relative" }}>
        {/* Header */}
        <div style={{ marginBottom: "4vh" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontSize: "0.85vw",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0.4vh 1vw",
              borderRadius: "0.3vw",
              marginBottom: "2vh",
            }}
          >
            Module 5
          </div>
          <h2
            style={{
              fontSize: "5.2vw",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Safeguarding
          </h2>
        </div>

        {/* Three columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2vw", flex: 1, alignContent: "start" }}>
          {/* Column 1 */}
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "0.1vw solid rgba(255,255,255,0.1)",
              borderRadius: "1.2vw",
              padding: "2.5vh 2vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#dc2626" }} />
            <div style={{ fontSize: "2.5vw", marginTop: "0.5vh" }}>
              <span role="img" aria-hidden="true">🚨</span>
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#ffffff" }}>Emergencies</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Log any incident via the Emergencies menu immediately
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Admin is notified in real time — never delay reporting
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                All logs are auditable and time-stamped
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "0.1vw solid rgba(255,255,255,0.1)",
              borderRadius: "1.2vw",
              padding: "2.5vh 2vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#f59e0b" }} />
            <div style={{ fontSize: "2.5vw", marginTop: "0.5vh" }}>
              <span role="img" aria-hidden="true">🔒</span>
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#ffffff" }}>Child Release</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Only release a child to a verified parent or delegate at the collection point
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Attendants verify identity — do not bypass this step
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                If unsure, contact admin before releasing
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "0.1vw solid rgba(255,255,255,0.1)",
              borderRadius: "1.2vw",
              padding: "2.5vh 2vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "0.5vh", backgroundColor: "#16a34a" }} />
            <div style={{ fontSize: "2.5vw", marginTop: "0.5vh" }}>
              <span role="img" aria-hidden="true">📝</span>
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#ffffff" }}>Allergy Alerts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Children with allergies are flagged in red in your roster
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Review all allergy notes before snack time or any activity
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                Log any adverse reaction immediately as an emergency
              </div>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div
          style={{
            marginTop: "3vh",
            backgroundColor: "rgba(220,38,38,0.1)",
            border: "0.1vw solid rgba(220,38,38,0.3)",
            borderRadius: "0.8vw",
            padding: "1.8vh 2vw",
            display: "flex",
            gap: "1vw",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "1.5vw", flexShrink: 0 }}>
            <span role="img" aria-hidden="true">⚠️</span>
          </div>
          <div style={{ fontSize: "1.15vw", fontWeight: 400, color: "rgba(255,255,255,0.8)", lineHeight: 1.4 }}>
            A child must never be left unattended or handed to an unverified adult. When in doubt, call admin at once — every precaution is the right precaution.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "rgba(15,23,74,0.9)",
          padding: "1.2vh 7vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)" }}>
          Shepherd Connect · Teacher Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
