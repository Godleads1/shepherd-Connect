export default function Slide3Account() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#fafafa",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "0.6vw",
          height: "100vh",
          backgroundColor: "#1e3a8a",
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          padding: "5vh 6vw 5vh 7.5vw",
          gap: "5vw",
          boxSizing: "border-box",
        }}
      >
        {/* Left column */}
        <div style={{ flex: "0 0 42vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#1e3a8a",
              color: "#f59e0b",
              fontSize: "0.85vw",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0.4vh 1vw",
              borderRadius: "0.3vw",
              marginBottom: "2.5vh",
              width: "fit-content",
            }}
          >
            Getting Started
          </div>
          <h2
            style={{
              fontSize: "5.5vw",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#1e3a8a",
              margin: "0 0 1.5vh 0",
              lineHeight: 1.1,
            }}
          >
            Create Your Account
          </h2>
          <p
            style={{
              fontSize: "1.7vw",
              fontWeight: 300,
              color: "#64748b",
              lineHeight: 1.5,
              margin: "0 0 4vh 0",
            }}
          >
            Register once. Your account stays active every Sunday after admin approval.
          </p>

          {/* Important note */}
          <div
            style={{
              backgroundColor: "#fef3c7",
              border: "0.15vw solid #f59e0b",
              borderRadius: "0.8vw",
              padding: "2vh 2vw",
              display: "flex",
              gap: "1vw",
              alignItems: "flex-start",
            }}
          >
            <div style={{ fontSize: "1.8vw", flexShrink: 0, marginTop: "0.1vh" }}>
              <span role="img" aria-hidden="true">⏳</span>
            </div>
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#92400e", marginBottom: "0.5vh" }}>
                Pending Approval
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>
                Teacher accounts require super-admin approval before first login. You'll be notified once access is granted.
              </div>
            </div>
          </div>
        </div>

        {/* Right column — steps */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "2vh" }}>
          {/* Step 1 */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "0.1vw solid #e2e8f0",
              borderRadius: "1vw",
              padding: "2.2vh 2vw",
              display: "flex",
              gap: "1.5vw",
              alignItems: "flex-start",
              boxShadow: "0 0.2vw 0.6vw rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "#1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.6vw",
                fontWeight: 700,
                color: "#ffffff",
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.5vh" }}>Open the app and tap Register</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>
                Visit shepherdconnect.church and click <strong>Register</strong>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "0.1vw solid #e2e8f0",
              borderRadius: "1vw",
              padding: "2.2vh 2vw",
              display: "flex",
              gap: "1.5vw",
              alignItems: "flex-start",
              boxShadow: "0 0.2vw 0.6vw rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "#1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.6vw",
                fontWeight: 700,
                color: "#ffffff",
                flexShrink: 0,
              }}
            >
              2
            </div>
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.5vh" }}>
                Select the <span style={{ color: "#1e3a8a" }}>Teacher</span> role
              </div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>
                Choose <strong>Teacher</strong> from the role dropdown — not Parent or Attendant
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "0.1vw solid #e2e8f0",
              borderRadius: "1vw",
              padding: "2.2vh 2vw",
              display: "flex",
              gap: "1.5vw",
              alignItems: "flex-start",
              boxShadow: "0 0.2vw 0.6vw rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "#1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.6vw",
                fontWeight: 700,
                color: "#ffffff",
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.5vh" }}>Fill in your details and submit</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>
                Enter your name, email, and password. Admin assigns your class after approval.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#1e3a8a",
          padding: "1.2vh 7.5vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)" }}>
          Shepherd Connect · Teacher Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
