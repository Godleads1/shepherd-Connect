export default function Slide2Register() {
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
          Getting Started
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
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
          Step 1
        </div>
        <h2
          style={{
            fontSize: "5vw",
            fontWeight: 200,
            letterSpacing: "-0.04em",
            margin: "0 0 1.5vh 0",
            lineHeight: 1.1,
          }}
        >
          Create your{" "}
          <span style={{ color: "#1e3a8a", fontWeight: 600 }}>account</span>
        </h2>
        <p
          style={{
            fontSize: "1.8vw",
            fontWeight: 300,
            color: "#86868b",
            marginBottom: "6vh",
            letterSpacing: "-0.01em",
          }}
        >
          Registration takes under two minutes.
        </p>

        <div style={{ display: "flex", gap: "2.5vw" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3.5vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div
              style={{
                width: "4vw",
                height: "4vw",
                backgroundColor: "#1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8vw",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              1
            </div>
            <div style={{ fontSize: "1.6vw", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Open the app
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 400, color: "#86868b", letterSpacing: "-0.01em", lineHeight: 1.4 }}>
              Visit shepherdconnect.church and tap Register
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3.5vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div
              style={{
                width: "4vw",
                height: "4vw",
                backgroundColor: "#1e3a8a",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8vw",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              2
            </div>
            <div style={{ fontSize: "1.6vw", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Fill in your details
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 400, color: "#86868b", letterSpacing: "-0.01em", lineHeight: 1.4 }}>
              Name, email, phone number, and a secure password
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "#1e3a8a",
              borderRadius: "1.2vw",
              padding: "3.5vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div
              style={{
                width: "4vw",
                height: "4vw",
                backgroundColor: "#f59e0b",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.8vw",
                fontWeight: 700,
                color: "#1d1d1f",
              }}
            >
              3
            </div>
            <div style={{ fontSize: "1.6vw", fontWeight: 600, color: "#ffffff", letterSpacing: "-0.02em" }}>
              You're in
            </div>
            <div style={{ fontSize: "1.35vw", fontWeight: 400, color: "rgba(255,255,255,0.65)", letterSpacing: "-0.01em", lineHeight: 1.4 }}>
              Admins may activate your account before your first login
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>02</div>
      </div>
    </div>
  );
}
