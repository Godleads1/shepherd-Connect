export default function Slide3QRCheckin() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
        color: "#1d1d1f",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ backgroundColor: "#1e3a8a", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Check-In Kiosk</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left: steps */}
        <div style={{ flex: "0 0 38vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
            Check-in is your first interaction with each family on Sunday. Confirm the child and their health notes before they join their class.
          </p>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>How to check in a child</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Go to Check-In</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Open the Check-In page from the sidebar. Keep it open all morning.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Scan QR or search by name</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Each child has a QR code in the app. Or type their name to find them.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Check allergy &amp; medical notes</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Read any allergy alerts shown on the child's record before confirming.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>4</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Confirm Check-In</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Tap Confirm. The child's status updates and the teacher is notified.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: what to look for */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>What to check on arrival</div>

          <div style={{ backgroundColor: "#fee2e2", border: "0.1vw solid #fca5a5", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#dc2626", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#7f1d1d", marginBottom: "0.4vh" }}>Allergy alert shown</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#991b1b", lineHeight: 1.4 }}>Inform the class teacher before the child enters. Do not dismiss the alert.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fef3c7", border: "0.1vw solid #fde68a", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#92400e", marginBottom: "0.4vh" }}>Medical notes present</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>Relay any medical information to the teacher verbally at handover.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#dcfce7", border: "0.1vw solid #86efac", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#16a34a", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#14532d", marginBottom: "0.4vh" }}>No alerts — clear to proceed</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#166534", lineHeight: 1.4 }}>Confirm check-in and direct the family to the correct class room.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#ffffff", border: "0.1vw solid #e2e8f0", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", marginTop: "auto" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.4vh" }}>Already checked in?</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#374151", lineHeight: 1.4 }}>If the child appears as already checked in, do not check in again. Contact an admin.</div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Attendant Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
