export default function Slide5DelegateOTP() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#0d1f4a",
        fontFamily: "'Inter', sans-serif",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: "40vw", height: "60vh", background: "radial-gradient(ellipse at 90% 10%, rgba(245,158,11,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ backgroundColor: "rgba(245,158,11,0.15)", borderBottom: "0.1vw solid rgba(245,158,11,0.3)", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Delegate OTP Checkout</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden", position: "relative" }}>

        <div style={{ flex: "0 0 40vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, margin: 0 }}>
            When a parent cannot collect their child, they add a trusted delegate in the app. The delegate receives a one-time 6-digit code to present at the kiosk.
          </p>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Steps for OTP checkout</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#1d1d1f" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Open the "Delegate OTP" tab</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>On the Check Out page, select the Delegate OTP tab — not Parent Checkout</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#1d1d1f" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Ask the delegate for their code</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>The delegate should have a 6-digit code from the parent's app. Valid for 24 hours.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#f59e0b", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#1d1d1f" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Enter the 6-digit code</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Type the code into the field. The app matches it to a child and shows the delegate's name.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>4</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#ffffff", marginBottom: "0.3vh" }}>Verify and confirm</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Confirm the delegate matches. Tap Confirm — the code is consumed and cannot be reused.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: "0.1vw", backgroundColor: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>OTP code rules</div>

          <div style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "0.1vw solid rgba(245,158,11,0.3)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#fde68a", marginBottom: "0.4vh" }}>Valid for 24 hours</div>
            <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>The code expires automatically after 24 hours from when it was generated.</div>
          </div>

          <div style={{ backgroundColor: "rgba(245,158,11,0.12)", border: "0.1vw solid rgba(245,158,11,0.3)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#fde68a", marginBottom: "0.4vh" }}>Single use only</div>
            <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Once used successfully, the code is consumed and cannot be reused for another child or on another day.</div>
          </div>

          <div style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "0.1vw solid rgba(220,38,38,0.3)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#fca5a5", marginBottom: "0.4vh" }}>Code rejected?</div>
            <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>Do not release the child. Ask the delegate to contact the parent, or escalate to admin.</div>
          </div>

          <div style={{ backgroundColor: "rgba(30,58,138,0.4)", border: "0.1vw solid rgba(30,58,138,0.6)", borderRadius: "0.8vw", padding: "1.6vh 1.5vw" }}>
            <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#93c5fd", marginBottom: "0.4vh" }}>No code — no release</div>
            <div style={{ fontSize: "1vw", fontWeight: 300, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>If a delegate arrives without a code, they must be refused. Ask them to contact the parent directly.</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "0.1vw solid rgba(255,255,255,0.08)", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.25)", letterSpacing: "0.02em" }}>Shepherd Connect · Attendant Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.35)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
