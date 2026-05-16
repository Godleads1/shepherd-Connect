export default function Slide4CheckIn() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#1e3a8a",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "6vh 7vw",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Shepherd Connect
        </div>
        <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>
          Check-In
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flex: 1, gap: "6vw" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: "1vw",
              fontWeight: 600,
              color: "#f59e0b",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "2vh",
            }}
          >
            Step 3
          </div>
          <h2
            style={{
              fontSize: "5.5vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              margin: "0 0 3vh 0",
              lineHeight: 1.05,
              color: "#ffffff",
            }}
          >
            Arrive. Scan.{" "}
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>Done.</span>
          </h2>
          <p
            style={{
              fontSize: "1.75vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              marginBottom: "5vh",
            }}
          >
            Our attendants at the kiosk will scan your child's profile QR code to check them in — no forms, no queues.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", height: "0.4vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0, marginTop: "0.8vh" }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "rgba(255,255,255,0.85)" }}>Child's class and teacher are confirmed instantly</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", height: "0.4vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0, marginTop: "0.8vh" }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "rgba(255,255,255,0.85)" }}>Allergy alerts appear on screen for the attendant</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5vw" }}>
              <div style={{ width: "0.4vw", height: "0.4vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0, marginTop: "0.8vh" }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "rgba(255,255,255,0.85)" }}>You receive a check-in notification on your phone</span>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 28vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "24vw",
              height: "24vw",
              backgroundColor: "#ffffff",
              borderRadius: "2vw",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2vh",
              padding: "2.5vw",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "0.4vw",
                width: "14vw",
              }}
            >
              {[
                1,1,1,0,0, 0,1,0,0,1, 1,1,1,0,0,
                0,0,0,1,0, 0,1,0,1,0, 0,0,0,0,1,
                1,0,1,0,1, 0,1,0,0,0, 1,0,1,1,1,
                1,1,1,0,0, 0,0,0,1,0, 1,1,1,1,0,
                0,0,1,1,0,
              ].map((cell, i) => (
                <div
                  key={i}
                  style={{
                    width: "100%",
                    paddingBottom: "100%",
                    backgroundColor: cell ? "#1e3a8a" : "transparent",
                    borderRadius: "0.1vw",
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#1e3a8a", letterSpacing: "0.02em", textAlign: "center" }}>
              Child QR Code
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>04</div>
      </div>
    </div>
  );
}
