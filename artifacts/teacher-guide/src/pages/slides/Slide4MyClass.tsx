export default function Slide4MyClass() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#0f172a",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        boxSizing: "border-box",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 10% 50%, rgba(30,58,138,0.7) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50vw",
          height: "100vh",
          background: "radial-gradient(ellipse at 90% 30%, rgba(245,158,11,0.1) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Left panel */}
      <div
        style={{
          flex: "0 0 45vw",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "5vh 4vw 5vh 7vw",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "inline-block",
            backgroundColor: "#f59e0b",
            color: "#1d1d1f",
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
          Module 1
        </div>
        <h2
          style={{
            fontSize: "5.8vw",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#ffffff",
            margin: "0 0 2vh 0",
            lineHeight: 1.05,
          }}
        >
          My Class
        </h2>
        <p
          style={{
            fontSize: "1.7vw",
            fontWeight: 300,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.5,
            marginBottom: "4vh",
          }}
        >
          Your class roster — every child assigned to you, with real-time attendance status.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.2vw", flexShrink: 0 }} />
            <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
              See each child's name, photo, and class
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.2vw", flexShrink: 0 }} />
            <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
              Allergy and medical notes highlighted in red
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.2vw", flexShrink: 0 }} />
            <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
              Live check-in status — present, absent, or picked up
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
            <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.2vw", flexShrink: 0 }} />
            <div style={{ fontSize: "1.3vw", fontWeight: 400, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
              Tap any child to open their full profile
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — mock class roster */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "5vh 6vw 5vh 2vw",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "0.1vw solid rgba(255,255,255,0.12)",
            borderRadius: "1.5vw",
            overflow: "hidden",
          }}
        >
          {/* Class header */}
          <div
            style={{
              backgroundColor: "#1e3a8a",
              padding: "1.8vh 2vw",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#ffffff" }}>Cherubim Class</div>
            <div
              style={{
                backgroundColor: "#f59e0b",
                color: "#1d1d1f",
                fontSize: "0.9vw",
                fontWeight: 700,
                padding: "0.3vh 0.8vw",
                borderRadius: "2vw",
              }}
            >
              4 / 5 checked in
            </div>
          </div>

          {/* Child rows */}
          <div style={{ padding: "1vh 0" }}>
            {/* Child 1 */}
            <div
              style={{
                padding: "1.4vh 2vw",
                display: "flex",
                alignItems: "center",
                gap: "1.2vw",
                borderBottom: "0.1vw solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#2563eb", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", fontWeight: 700, flexShrink: 0 }}>A</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#ffffff" }}>Adaeze Okonkwo</div>
                <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)" }}>Age 5 · Cherubim</div>
              </div>
              <div style={{ backgroundColor: "#16a34a20", border: "0.1vw solid #16a34a50", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.9vw", fontWeight: 600, color: "#4ade80" }}>Present</div>
            </div>
            {/* Child 2 — allergy */}
            <div
              style={{
                padding: "1.4vh 2vw",
                display: "flex",
                alignItems: "center",
                gap: "1.2vw",
                borderBottom: "0.1vw solid rgba(255,255,255,0.06)",
                backgroundColor: "rgba(220,38,38,0.08)",
              }}
            >
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#dc2626", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", fontWeight: 700, flexShrink: 0 }}>E</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#ffffff" }}>Emmanuel Balogun</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5vw", marginTop: "0.2vh" }}>
                  <div style={{ backgroundColor: "#dc2626", color: "#ffffff", fontSize: "0.8vw", fontWeight: 700, padding: "0.1vh 0.5vw", borderRadius: "0.3vw", textTransform: "uppercase", letterSpacing: "0.06em" }}>Allergy</div>
                  <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)" }}>Peanuts</div>
                </div>
              </div>
              <div style={{ backgroundColor: "#16a34a20", border: "0.1vw solid #16a34a50", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.9vw", fontWeight: 600, color: "#4ade80" }}>Present</div>
            </div>
            {/* Child 3 — in transit */}
            <div
              style={{
                padding: "1.4vh 2vw",
                display: "flex",
                alignItems: "center",
                gap: "1.2vw",
                borderBottom: "0.1vw solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#d97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", fontWeight: 700, flexShrink: 0 }}>C</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#ffffff" }}>Chidinma Eze</div>
                <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)" }}>Age 6 · Cherubim</div>
              </div>
              <div style={{ backgroundColor: "#d9770620", border: "0.1vw solid #d9770650", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.9vw", fontWeight: 600, color: "#fbbf24" }}>In Transit</div>
            </div>
            {/* Child 4 */}
            <div
              style={{
                padding: "1.4vh 2vw",
                display: "flex",
                alignItems: "center",
                gap: "1.2vw",
                borderBottom: "0.1vw solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#7c3aed", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", fontWeight: 700, flexShrink: 0 }}>T</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "#ffffff" }}>Tobiloba Adeyemi</div>
                <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.45)" }}>Age 7 · Cherubim</div>
              </div>
              <div style={{ backgroundColor: "#16a34a20", border: "0.1vw solid #16a34a50", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.9vw", fontWeight: 600, color: "#4ade80" }}>Present</div>
            </div>
            {/* Child 5 — absent */}
            <div
              style={{
                padding: "1.4vh 2vw",
                display: "flex",
                alignItems: "center",
                gap: "1.2vw",
              }}
            >
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#475569", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4vw", fontWeight: 700, flexShrink: 0, opacity: 0.7 }}>O</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Oluwafemi Abiodun</div>
                <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.3)" }}>Age 5 · Cherubim</div>
              </div>
              <div style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "0.1vw solid rgba(255,255,255,0.15)", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.9vw", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Absent</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(30,58,138,0.9)",
          padding: "1.2vh 7vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
