export default function Slide7ClassChange() {
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
          backgroundColor: "#7c3aed",
        }}
      />

      <div style={{ flex: 1, display: "flex", padding: "5vh 6vw 5vh 7.5vw", gap: "5vw", boxSizing: "border-box" }}>
        {/* Left */}
        <div style={{ flex: "0 0 42vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#7c3aed",
              color: "#ffffff",
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
            Module 4
          </div>
          <h2
            style={{
              fontSize: "5.2vw",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#1e3a8a",
              margin: "0 0 2vh 0",
              lineHeight: 1.1,
            }}
          >
            Class Change Requests
          </h2>
          <p
            style={{
              fontSize: "1.6vw",
              fontWeight: 300,
              color: "#64748b",
              lineHeight: 1.55,
              marginBottom: "4vh",
            }}
          >
            When a child needs to move classes — due to age, behaviour, or logistics — submit a formal request through the app.
          </p>

          <div
            style={{
              backgroundColor: "#f5f3ff",
              border: "0.15vw solid #c4b5fd",
              borderRadius: "0.8vw",
              padding: "2vh 2vw",
            }}
          >
            <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#5b21b6", marginBottom: "1vh" }}>
              Teachers can also submit
            </div>
            <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#6d28d9", lineHeight: 1.5 }}>
              You can submit a class change request on behalf of a child in your class — not just admins or parents. The admin will review and approve or reject with notes.
            </div>
          </div>
        </div>

        {/* Right — flow */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.8vh" }}>
          {/* Step 1 */}
          <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "#7c3aed",
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
            <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.8vh 1.8vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.4vh" }}>Go to Class Change Requests</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Find it in the main navigation menu</div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "#7c3aed",
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
            <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.8vh 1.8vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.4vh" }}>Select child, new class, and reason</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Choose the child, pick the target class, and explain the reason clearly</div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", gap: "1.5vw", alignItems: "flex-start" }}>
            <div
              style={{
                width: "3.5vw",
                height: "3.5vw",
                backgroundColor: "#7c3aed",
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
            <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.8vh 1.8vw", flex: 1, boxShadow: "0 0.1vw 0.4vw rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.4vh" }}>Submit — admin reviews</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Admin approves or rejects with notes. If approved, the child is moved automatically.</div>
            </div>
          </div>

          {/* Status badges */}
          <div style={{ display: "flex", gap: "1.2vw", marginTop: "0.5vh" }}>
            <div style={{ backgroundColor: "#fef3c7", border: "0.1vw solid #fcd34d", borderRadius: "2vw", padding: "0.5vh 1.2vw", fontSize: "1.05vw", fontWeight: 600, color: "#92400e" }}>
              Pending review
            </div>
            <div style={{ backgroundColor: "#f0fdf4", border: "0.1vw solid #bbf7d0", borderRadius: "2vw", padding: "0.5vh 1.2vw", fontSize: "1.05vw", fontWeight: 600, color: "#166534" }}>
              Approved
            </div>
            <div style={{ backgroundColor: "#fef2f2", border: "0.1vw solid #fecaca", borderRadius: "2vw", padding: "0.5vh 1.2vw", fontSize: "1.05vw", fontWeight: 600, color: "#991b1b" }}>
              Rejected (with notes)
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
