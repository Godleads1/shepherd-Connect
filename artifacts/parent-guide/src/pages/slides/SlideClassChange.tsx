export default function SlideClassChange() {
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#86868b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Shepherd Connect
        </div>
        <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#86868b" }}>
          Class Change Request
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", gap: "6vw", flex: 1, alignItems: "center" }}>

        {/* Left — request card mock-up */}
        <div
          style={{
            flex: "0 0 38vw",
            backgroundColor: "#ffffff",
            border: "0.1vw solid #e5e7eb",
            borderRadius: "1.8vw",
            padding: "4vh 3.5vw",
            boxShadow: "0 1vw 3vw rgba(0,0,0,0.07)",
            display: "flex",
            flexDirection: "column",
            gap: "2.5vh",
          }}
        >
          {/* "Your child" mini header */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div
              style={{
                width: "4vw",
                height: "4vw",
                backgroundColor: "#dbeafe",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.6vw",
              }}
            >
              👦
            </div>
            <div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f" }}>Emmanuel Okafor</div>
              <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#86868b" }}>Currently in: Sunflower Class</div>
            </div>
          </div>

          {/* Arrow flow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5vw",
              backgroundColor: "#f0f7ff",
              borderRadius: "0.8vw",
              padding: "1.8vh 2vw",
            }}
          >
            <div
              style={{
                flex: 1,
                backgroundColor: "#1e3a8a",
                borderRadius: "0.6vw",
                padding: "1vh 1.2vw",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.9vw", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>From</div>
              <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#ffffff" }}>Sunflower</div>
            </div>
            <div style={{ fontSize: "2vw", color: "#1e3a8a" }}>→</div>
            <div
              style={{
                flex: 1,
                backgroundColor: "#f59e0b",
                borderRadius: "0.6vw",
                padding: "1vh 1.2vw",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.9vw", fontWeight: 500, color: "rgba(30,20,0,0.6)" }}>To</div>
              <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f" }}>Eagles Class</div>
            </div>
          </div>

          {/* Reason field */}
          <div>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.8vh" }}>
              Reason
            </div>
            <div
              style={{
                backgroundColor: "#F5F5F7",
                borderRadius: "0.6vw",
                padding: "1.5vh 1.5vw",
                fontSize: "1.2vw",
                fontWeight: 300,
                color: "#86868b",
                lineHeight: 1.5,
              }}
            >
              Emmanuel has grown significantly and would benefit from being with older children.
            </div>
          </div>

          {/* Status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
            <div
              style={{
                backgroundColor: "#dcfce7",
                borderRadius: "2vw",
                padding: "0.6vh 1.5vw",
                fontSize: "1.05vw",
                fontWeight: 600,
                color: "#16a34a",
              }}
            >
              ✓ Approved — moved automatically
            </div>
          </div>
        </div>

        {/* Right — explanation */}
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
            Need a{" "}
            <span style={{ color: "#1e3a8a", fontWeight: 600 }}>class change?</span>
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
            If your child has outgrown their current class or needs to move for any reason, you can request a change directly from the app — no forms, no queues.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "2vh" }}>
            {[
              { n: "1", label: "Open My Family", sub: "Tap your child's name" },
              { n: "2", label: "Request Class Change", sub: "Choose the new class and write a brief reason" },
              { n: "3", label: "Admin reviews it", sub: "You'll be notified when it's approved or declined" },
              { n: "4", label: "Auto-move on approval", sub: "Your child is transferred to the new class instantly" },
            ].map(step => (
              <div key={step.n} style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
                <div
                  style={{
                    width: "2.8vw",
                    height: "2.8vw",
                    backgroundColor: "#1e3a8a",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontSize: "1.1vw",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <div style={{ fontSize: "1.4vw", fontWeight: 600, color: "#1d1d1f" }}>{step.label}</div>
                  <div style={{ fontSize: "1.15vw", fontWeight: 300, color: "#86868b" }}>{step.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>07</div>
      </div>
    </div>
  );
}
