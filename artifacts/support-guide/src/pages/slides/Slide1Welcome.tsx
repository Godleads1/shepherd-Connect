const base = import.meta.env.BASE_URL;

export default function Slide1Welcome() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <img
        src={`${base}hero-attendant.png`}
        crossOrigin="anonymous"
        alt="Attendant welcoming families at church kiosk"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to right, rgba(10,20,60,0.9) 50%, rgba(10,20,60,0.3) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "6vh 7vw",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: "1.2vw", fontWeight: 500, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Shepherd Connect
          </div>
          <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>
            Attendant Guide · 2026
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "54vw" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#f59e0b",
              color: "#1d1d1f",
              fontSize: "1vw",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0.5vh 1.2vw",
              borderRadius: "0.3vw",
              marginBottom: "3vh",
              width: "fit-content",
            }}
          >
            RCCG City of David
          </div>
          <h1
            style={{
              fontSize: "7.5vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              margin: 0,
              lineHeight: 1.05,
            }}
          >
            Your{" "}
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>Attendant</span>
            <span style={{ fontWeight: 200, color: "#ffffff" }}> Guide</span>
          </h1>
          <p
            style={{
              fontSize: "2vw",
              fontWeight: 300,
              color: "rgba(255,255,255,0.75)",
              marginTop: "3vh",
              letterSpacing: "-0.01em",
              lineHeight: 1.45,
            }}
          >
            Check-in, checkout, and{" "}
            <span style={{ color: "#f59e0b", fontWeight: 500 }}>every child</span>{" "}
            released safely to the right person.
          </p>

          <div style={{ marginTop: "5vh", display: "flex", gap: "2vw" }}>
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "0.1vw solid rgba(255,255,255,0.2)",
                borderRadius: "0.6vw",
                padding: "1.5vh 1.5vw",
                display: "flex",
                flexDirection: "column",
                gap: "0.4vh",
              }}
            >
              <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b" }}>Check-In</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.6)" }}>Scan QR or search child</div>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "0.1vw solid rgba(255,255,255,0.2)",
                borderRadius: "0.6vw",
                padding: "1.5vh 1.5vw",
                display: "flex",
                flexDirection: "column",
                gap: "0.4vh",
              }}
            >
              <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b" }}>Checkout</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.6)" }}>Parent or delegate pickup</div>
            </div>
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "0.1vw solid rgba(255,255,255,0.2)",
                borderRadius: "0.6vw",
                padding: "1.5vh 1.5vw",
                display: "flex",
                flexDirection: "column",
                gap: "0.4vh",
              }}
            >
              <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b" }}>OTP Verify</div>
              <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.6)" }}>Delegate 6-digit code</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "1vw", fontWeight: 400, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
