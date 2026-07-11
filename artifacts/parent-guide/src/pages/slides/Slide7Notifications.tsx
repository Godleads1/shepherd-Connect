export default function Slide7Notifications() {
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
          Notifications
        </div>
      </div>

      <div style={{ display: "flex", gap: "6vw", flex: 1, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2
            style={{
              fontSize: "4.8vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              margin: "0 0 2vh 0",
              lineHeight: 1.1,
            }}
          >
            Stay{" "}
            <span style={{ color: "#1e3a8a", fontWeight: 600 }}>informed</span>,
            always
          </h2>
          <p
            style={{
              fontSize: "1.75vw",
              fontWeight: 300,
              color: "#86868b",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              marginBottom: "5vh",
            }}
          >
            Shepherd Connect sends you real-time updates at every key moment, so you never have to wonder.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div
                style={{
                  width: "3.5vw",
                  height: "3.5vw",
                  backgroundColor: "#dbeafe",
                  borderRadius: "0.8vw",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5vw",
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.3vh" }}>Check-in confirmed</div>
                <div style={{ fontSize: "1.25vw", fontWeight: 300, color: "#86868b" }}>The moment your child arrives in class</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div
                style={{
                  width: "3.5vw",
                  height: "3.5vw",
                  backgroundColor: "#fef3c7",
                  borderRadius: "0.8vw",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5vw",
                  flexShrink: 0,
                }}
              >
                →
              </div>
              <div>
                <div style={{ fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.3vh" }}>In transit</div>
                <div style={{ fontSize: "1.25vw", fontWeight: 300, color: "#86868b" }}>Teacher is walking your child to you now</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div
                style={{
                  width: "3.5vw",
                  height: "3.5vw",
                  backgroundColor: "#dcfce7",
                  borderRadius: "0.8vw",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5vw",
                  flexShrink: 0,
                }}
              >
                ✓✓
              </div>
              <div>
                <div style={{ fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.3vh" }}>Picked up</div>
                <div style={{ fontSize: "1.25vw", fontWeight: 300, color: "#86868b" }}>Checkout complete and recorded</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div
                style={{
                  width: "3.5vw",
                  height: "3.5vw",
                  backgroundColor: "#F5F5F7",
                  borderRadius: "0.8vw",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5vw",
                  flexShrink: 0,
                }}
              >
                !
              </div>
              <div>
                <div style={{ fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.3vh" }}>Broadcast alerts</div>
                <div style={{ fontSize: "1.25vw", fontWeight: 300, color: "#86868b" }}>Church-wide announcements from admin</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 28vw", display: "flex", flexDirection: "column", justifyContent: "center", gap: "2vh" }}>
          <div
            style={{
              backgroundColor: "#1e3a8a",
              borderRadius: "1.5vw",
              padding: "4vh 2.5vw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>
              Your preferences
            </div>
            <div style={{ fontSize: "1.5vw", fontWeight: 300, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
              Choose in-app, WhatsApp, or SMS notifications from your Profile settings.
            </div>
          </div>
          <div
            style={{
              backgroundColor: "#F5F5F7",
              borderRadius: "1.5vw",
              padding: "3.5vh 2.5vw",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5vw", fontWeight: 400, color: "#86868b", lineHeight: 1.5 }}>
              All notifications are stored in your inbox. Nothing is missed.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>10</div>
      </div>
    </div>
  );
}
