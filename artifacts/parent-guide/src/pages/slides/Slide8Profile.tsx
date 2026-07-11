export default function Slide8Profile() {
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
          Your Profile
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
          Manage everything
        </div>
        <h2
          style={{
            fontSize: "4.5vw",
            fontWeight: 200,
            letterSpacing: "-0.04em",
            margin: "0 0 1.5vh 0",
            lineHeight: 1.1,
          }}
        >
          Your{" "}
          <span style={{ color: "#1e3a8a", fontWeight: 600 }}>profile</span>,
          your control
        </h2>
        <p
          style={{
            fontSize: "1.75vw",
            fontWeight: 300,
            color: "#86868b",
            marginBottom: "4.5vh",
            letterSpacing: "-0.01em",
          }}
        >
          Everything about your family, in one place.
        </p>

        <div style={{ display: "flex", gap: "2vw" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1e3a8a" }}>Personal details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>Name and photo</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>Phone number</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>Place of work</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1e3a8a" }}>Communication</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>In-app notifications</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>WhatsApp updates</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>SMS alerts</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "#1e3a8a",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#f59e0b" }}>Profile complete</div>
            <div
              style={{
                height: "0.6vh",
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "0.3vh",
                overflow: "hidden",
                marginTop: "0.5vh",
              }}
            >
              <div style={{ width: "80%", height: "100%", backgroundColor: "#f59e0b", borderRadius: "0.3vh" }} />
            </div>
            <div style={{ fontSize: "1.3vw", fontWeight: 300, color: "rgba(255,255,255,0.65)" }}>
              A complete profile helps staff recognize and assist your family faster.
            </div>
          </div>

          <div
            style={{
              flex: 1,
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#1e3a8a" }}>Feedback</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>Rate your experience</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>Leave comments</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "#86868b" }}>Help us improve</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>11</div>
      </div>
    </div>
  );
}
