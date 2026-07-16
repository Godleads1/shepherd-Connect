export default function Slide10Profile() {
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
          backgroundColor: "#f59e0b",
        }}
      />

      <div style={{ flex: 1, display: "flex", padding: "5vh 6vw 5vh 7.5vw", gap: "5vw", boxSizing: "border-box" }}>
        {/* Left */}
        <div style={{ flex: "0 0 42vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
            Module 7
          </div>
          <h2
            style={{
              fontSize: "5.5vw",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#1e3a8a",
              margin: "0 0 2.5vh 0",
              lineHeight: 1.08,
            }}
          >
            Your Profile
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
            Keep your profile up to date so admin has your current contact details and communication preferences.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#1e3a8a", borderRadius: "0.2vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.25vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>
                Name, phone, date of birth, place of work
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#1e3a8a", borderRadius: "0.2vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.25vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>
                Profile photo URL for identification
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.2vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.25vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>
                Notification preferences — in-app, SMS, WhatsApp
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
              <div style={{ width: "0.4vw", height: "3.5vh", backgroundColor: "#f59e0b", borderRadius: "0.2vw", flexShrink: 0 }} />
              <div style={{ fontSize: "1.25vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>
                Completeness progress bar shows what's still missing
              </div>
            </div>
          </div>
        </div>

        {/* Right — profile mock */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              backgroundColor: "#ffffff",
              border: "0.1vw solid #e2e8f0",
              borderRadius: "1.5vw",
              overflow: "hidden",
              boxShadow: "0 0.3vw 1vw rgba(0,0,0,0.06)",
            }}
          >
            {/* Profile header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                padding: "2.8vh 2.5vw",
                display: "flex",
                gap: "1.5vw",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "6vw",
                  height: "6vw",
                  borderRadius: "50%",
                  backgroundColor: "#f59e0b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5vw",
                  fontWeight: 700,
                  color: "#1d1d1f",
                  flexShrink: 0,
                  border: "0.3vw solid rgba(255,255,255,0.3)",
                }}
              >
                N
              </div>
              <div>
                <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Ngozi Okafor</div>
                <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "rgba(255,255,255,0.7)" }}>Cherubim Class Teacher</div>
              </div>
            </div>

            <div style={{ padding: "2.2vh 2.5vw" }}>
              {/* Completeness bar */}
              <div style={{ marginBottom: "2.2vh" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8vh" }}>
                  <div style={{ fontSize: "1.05vw", fontWeight: 600, color: "#374151" }}>Profile Completeness</div>
                  <div style={{ fontSize: "1.05vw", fontWeight: 700, color: "#16a34a" }}>80%</div>
                </div>
                <div style={{ height: "0.8vh", backgroundColor: "#e2e8f0", borderRadius: "1vw", overflow: "hidden" }}>
                  <div style={{ width: "80%", height: "100%", backgroundColor: "#16a34a", borderRadius: "1vw" }} />
                </div>
              </div>

              {/* Fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2vh" }}>
                <div style={{ backgroundColor: "#f8fafc", borderRadius: "0.5vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>Phone</div>
                  <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#1d1d1f" }}>+234 802 345 6789</div>
                </div>
                <div style={{ backgroundColor: "#f8fafc", borderRadius: "0.5vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3vh" }}>Place of Work</div>
                  <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#1d1d1f" }}>Zenith Bank</div>
                </div>

                {/* Notifications row */}
                <div style={{ gridColumn: "1 / -1", backgroundColor: "#f8fafc", borderRadius: "0.5vw", padding: "1.2vh 1.2vw" }}>
                  <div style={{ fontSize: "0.9vw", fontWeight: 600, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.8vh" }}>Notification Channels</div>
                  <div style={{ display: "flex", gap: "1vw" }}>
                    <div style={{ backgroundColor: "#dbeafe", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.95vw", fontWeight: 600, color: "#1e3a8a" }}>In-App</div>
                    <div style={{ backgroundColor: "#dcfce7", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.95vw", fontWeight: 600, color: "#166534" }}>WhatsApp</div>
                    <div style={{ backgroundColor: "#f1f5f9", borderRadius: "2vw", padding: "0.3vh 0.9vw", fontSize: "0.95vw", fontWeight: 400, color: "#94a3b8" }}>SMS (off)</div>
                  </div>
                </div>
              </div>
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
