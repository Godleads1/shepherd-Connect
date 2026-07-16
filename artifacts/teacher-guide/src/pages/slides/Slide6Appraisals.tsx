export default function Slide6Appraisals() {
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
        boxSizing: "border-box",
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 60% 10%, rgba(245,158,11,0.12) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      {/* Left — intro */}
      <div
        style={{
          flex: "0 0 44vw",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "5vh 3vw 5vh 7vw",
          boxSizing: "border-box",
          position: "relative",
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
          Module 3
        </div>
        <h2
          style={{
            fontSize: "5.5vw",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#ffffff",
            margin: "0 0 2.5vh 0",
            lineHeight: 1.08,
          }}
        >
          Child Appraisals
        </h2>
        <p
          style={{
            fontSize: "1.6vw",
            fontWeight: 300,
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1.55,
            marginBottom: "4vh",
          }}
        >
          Write short reports on each child's participation, behaviour, and spiritual growth. Parents see these in their app.
        </p>

        {/* Big stat */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "0.8vw",
            marginBottom: "1vh",
          }}
        >
          <div style={{ fontSize: "8vw", fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.05em", lineHeight: 1 }}>3</div>
          <div style={{ fontSize: "2vw", fontWeight: 300, color: "rgba(255,255,255,0.6)", lineHeight: 1.2 }}>taps to<br />submit</div>
        </div>
        <div style={{ fontSize: "1.2vw", fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>
          Select child → fill appraisal → submit
        </div>
      </div>

      {/* Right — appraisal form mock */}
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
            backgroundColor: "#ffffff",
            borderRadius: "1.5vw",
            overflow: "hidden",
            boxShadow: "0 1vw 3vw rgba(0,0,0,0.3)",
          }}
        >
          {/* Form header */}
          <div style={{ backgroundColor: "#f59e0b", padding: "1.8vh 2.2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "1.4vw", fontWeight: 700, color: "#1d1d1f" }}>New Appraisal</div>
            <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#78350f" }}>Adaeze Okonkwo</div>
          </div>

          <div style={{ padding: "2.5vh 2.2vw", display: "flex", flexDirection: "column", gap: "2.2vh" }}>
            {/* Behaviour */}
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#374151", marginBottom: "1vh" }}>Behaviour &amp; Conduct</div>
              <div style={{ display: "flex", gap: "0.6vw" }}>
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#1e3a8a", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#1e3a8a", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#1e3a8a", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#1e3a8a", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#e2e8f0", borderRadius: "0.5vw" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5vh" }}>
                <div style={{ fontSize: "0.85vw", color: "#9ca3af" }}>Needs work</div>
                <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#1e3a8a" }}>4 / 5</div>
                <div style={{ fontSize: "0.85vw", color: "#9ca3af" }}>Excellent</div>
              </div>
            </div>

            {/* Participation */}
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#374151", marginBottom: "1vh" }}>Class Participation</div>
              <div style={{ display: "flex", gap: "0.6vw" }}>
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#f59e0b", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#f59e0b", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#f59e0b", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#f59e0b", borderRadius: "0.5vw" }} />
                <div style={{ flex: 1, height: "1vh", backgroundColor: "#f59e0b", borderRadius: "0.5vw" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5vh" }}>
                <div style={{ fontSize: "0.85vw", color: "#9ca3af" }}>Needs work</div>
                <div style={{ fontSize: "0.85vw", fontWeight: 600, color: "#d97706" }}>5 / 5</div>
                <div style={{ fontSize: "0.85vw", color: "#9ca3af" }}>Excellent</div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 600, color: "#374151", marginBottom: "0.8vh" }}>Teacher Notes</div>
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "0.1vw solid #e2e8f0",
                  borderRadius: "0.6vw",
                  padding: "1.2vh 1.2vw",
                  fontSize: "1.05vw",
                  fontWeight: 400,
                  color: "#374151",
                  lineHeight: 1.5,
                }}
              >
                Adaeze showed great enthusiasm today — answered three questions unprompted and helped a classmate find her seat.
              </div>
            </div>

            {/* Submit button (visual only) */}
            <div
              style={{
                backgroundColor: "#1e3a8a",
                borderRadius: "0.6vw",
                padding: "1.4vh",
                textAlign: "center",
                fontSize: "1.2vw",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Submit Appraisal
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
          backgroundColor: "rgba(15,23,74,0.9)",
          padding: "1.2vh 7vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)" }}>
          Shepherd Connect · Teacher Guide · 2026
        </div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)" }}>
          shepherdconnect.church
        </div>
      </div>
    </div>
  );
}
