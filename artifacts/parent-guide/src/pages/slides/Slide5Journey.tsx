export default function Slide5Journey() {
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
          Your Child's Day
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flex: 1, justifyContent: "center", marginTop: "-3vh" }}>
        <h2
          style={{
            fontSize: "4.5vw",
            fontWeight: 200,
            letterSpacing: "-0.04em",
            margin: "0 0 1.5vh 0",
            lineHeight: 1.1,
          }}
        >
          Your child's{" "}
          <span style={{ color: "#1e3a8a", fontWeight: 600 }}>journey</span>{" "}
          on Sunday
        </h2>
        <p
          style={{
            fontSize: "1.6vw",
            fontWeight: 300,
            color: "#86868b",
            marginBottom: "6vh",
            letterSpacing: "-0.01em",
          }}
        >
          Every step is tracked so you always know where they are.
        </p>

        <div style={{ display: "flex", alignItems: "flex-start", gap: "0", width: "78vw" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "6vw",
                height: "6vw",
                backgroundColor: "#1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2.5vw",
                marginBottom: "2vh",
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1e3a8a", marginBottom: "1vh" }}>Drop-off</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "#86868b", lineHeight: 1.4, maxWidth: "14vw" }}>
              Checked in at the kiosk. You get a notification.
            </div>
          </div>

          <div style={{ flex: "0 0 10vw", display: "flex", alignItems: "center", marginTop: "3vh" }}>
            <div style={{ height: "0.15vw", width: "100%", background: "linear-gradient(to right, #1e3a8a, #86868b)" }} />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "6vw",
                height: "6vw",
                backgroundColor: "#F5F5F7",
                border: "0.2vw solid #1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2vw",
                color: "#1e3a8a",
                marginBottom: "2vh",
              }}
            >
              ★
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "1vh" }}>In class</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "#86868b", lineHeight: 1.4, maxWidth: "14vw" }}>
              Learning, growing, celebrated by their teacher.
            </div>
          </div>

          <div style={{ flex: "0 0 10vw", display: "flex", alignItems: "center", marginTop: "3vh" }}>
            <div style={{ height: "0.15vw", width: "100%", background: "linear-gradient(to right, #86868b, #f59e0b)" }} />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "6vw",
                height: "6vw",
                backgroundColor: "#f59e0b",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2vw",
                color: "#1d1d1f",
                marginBottom: "2vh",
              }}
            >
              →
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "1vh" }}>In transit</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "#86868b", lineHeight: 1.4, maxWidth: "14vw" }}>
              Teacher escorts them to you. You're notified.
            </div>
          </div>

          <div style={{ flex: "0 0 10vw", display: "flex", alignItems: "center", marginTop: "3vh" }}>
            <div style={{ height: "0.15vw", width: "100%", background: "linear-gradient(to right, #f59e0b, #22c55e)" }} />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "6vw",
                height: "6vw",
                backgroundColor: "#dcfce7",
                border: "0.2vw solid #22c55e",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2vw",
                color: "#16a34a",
                marginBottom: "2vh",
              }}
            >
              ✓✓
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#16a34a", marginBottom: "1vh" }}>Picked up</div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "#86868b", lineHeight: 1.4, maxWidth: "14vw" }}>
              Safely checked out. Record complete.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>07</div>
      </div>
    </div>
  );
}
