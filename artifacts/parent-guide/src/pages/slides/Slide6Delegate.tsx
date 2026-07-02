export default function Slide6Delegate() {
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
          Delegate Pickup
        </div>
      </div>

      <div style={{ display: "flex", gap: "6vw", alignItems: "center", flex: 1 }}>
        <div
          style={{
            flex: "0 0 42vw",
            backgroundColor: "#1e3a8a",
            borderRadius: "2vw",
            padding: "5vh 4vw",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "1vw", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2vh" }}>
            One-time code
          </div>
          <div
            style={{
              fontSize: "8vw",
              fontWeight: 700,
              color: "#f59e0b",
              letterSpacing: "0.2em",
              lineHeight: 1,
              marginBottom: "2.5vh",
            }}
          >
            4 8 2 9 1 7
          </div>
          <div style={{ fontSize: "1.35vw", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
            This 6-digit OTP is generated when you add a delegate. It's valid for 24 hours and shown once — copy it and share it with your trusted person.
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h2
            style={{
              fontSize: "4.2vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              margin: "0 0 2vh 0",
              lineHeight: 1.1,
            }}
          >
            Someone else picking{" "}
            <span style={{ color: "#1e3a8a", fontWeight: 600 }}>up today?</span>
          </h2>
          <p
            style={{
              fontSize: "1.65vw",
              fontWeight: 300,
              color: "#86868b",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              marginBottom: "4vh",
            }}
          >
            Add a delegate from your profile. They present their name and OTP at the kiosk — no ID needed, no confusion.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1e3a8a", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.45vw", fontWeight: 400 }}>Go to Delegates in your profile</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1e3a8a", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.45vw", fontWeight: 400 }}>Enter the delegate's name and phone number</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#1e3a8a", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.45vw", fontWeight: 400 }}>Copy the OTP and share it with them directly</span>
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
