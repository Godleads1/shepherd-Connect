export default function SlideRegisterFamily() {
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
          Your Family
        </div>
      </div>

      <div style={{ display: "flex", gap: "6vw", alignItems: "center", flex: 1 }}>
        <div style={{ flex: "0 0 42vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: "1vw",
              fontWeight: 600,
              color: "#1e3a8a",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "2vh",
            }}
          >
            Step 2
          </div>
          <h2
            style={{
              fontSize: "4.8vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              margin: "0 0 2vh 0",
              lineHeight: 1.1,
            }}
          >
            Register your{" "}
            <span style={{ color: "#1e3a8a", fontWeight: 600 }}>family</span>
          </h2>
          <p
            style={{
              fontSize: "1.75vw",
              fontWeight: 300,
              color: "#86868b",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              marginBottom: "4vh",
            }}
          >
            Once logged in, set up your family profile. This links your
            account to your household so children can be assigned to it.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Family name (e.g. "The Johnson Family")</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Home address</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Contact phone number</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Done once — your family is linked forever</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div
            style={{
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              borderLeft: "0.4vw solid #1e3a8a",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, marginBottom: "0.8vh" }}>Family name</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 300, color: "#86868b" }}>e.g. "The Johnson Family" — used on all check-in records</div>
          </div>
          <div
            style={{
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              borderLeft: "0.4vw solid #1e3a8a",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, marginBottom: "0.8vh" }}>Address & phone</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 300, color: "#86868b" }}>Used for emergency contact and delegate verification</div>
          </div>
          <div
            style={{
              backgroundColor: "#1e3a8a",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, color: "#f59e0b", marginBottom: "0.8vh" }}>One-time setup</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 300, color: "rgba(255,255,255,0.7)" }}>
              Register your family once and it persists every Sunday — no re-entry needed
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>04</div>
      </div>
    </div>
  );
}
