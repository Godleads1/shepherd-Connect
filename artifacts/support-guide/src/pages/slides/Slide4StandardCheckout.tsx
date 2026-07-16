export default function Slide4StandardCheckout() {
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
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Standard Checkout</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Attendant Guide · Shepherd Connect</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        <div style={{ flex: "0 0 38vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <p style={{ fontSize: "1.25vw", fontWeight: 300, color: "#374151", lineHeight: 1.55, margin: 0 }}>
            Standard checkout is for parents collecting their own child. Always verify the person at the kiosk matches the registered parent or guardian.
          </p>

          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Steps</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Go to Check Out</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Open the Check Out page and select the "Parent Checkout" tab</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Find the child</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Search by name. Only checked-in children will appear in the list.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Verify the parent</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Compare the face to the photo or ask for ID. If unsure — do not release.</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#ffffff" }}>4</div>
              </div>
              <div>
                <div style={{ fontSize: "1.15vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Confirm Checkout</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Tap Confirm. The parent receives a notification and the child's status updates.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Key rules</div>

          <div style={{ backgroundColor: "#fee2e2", border: "0.1vw solid #fca5a5", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#dc2626", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#7f1d1d", marginBottom: "0.4vh" }}>Never release to an unverified person</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#991b1b", lineHeight: 1.4 }}>If the person cannot be confirmed as the registered parent or a valid delegate, call an admin immediately.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fff7ed", border: "0.1vw solid #fed7aa", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#f97316", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#7c2d12", marginBottom: "0.4vh" }}>No physical child — no checkout</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#9a3412", lineHeight: 1.4 }}>Do not process a checkout unless the child is physically present at the kiosk with the adult.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#4f46e5", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#312e81", marginBottom: "0.4vh" }}>Parent not on file?</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#3730a3", lineHeight: 1.4 }}>If someone claims to be the parent but is not in the app, escalate to admin. Do not improvise.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#dcfce7", border: "0.1vw solid #86efac", borderRadius: "0.8vw", padding: "1.6vh 1.5vw", display: "flex", gap: "1.2vw", marginTop: "auto" }}>
            <div style={{ width: "0.5vw", backgroundColor: "#16a34a", borderRadius: "0.3vw", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.1vw", fontWeight: 700, color: "#14532d", marginBottom: "0.4vh" }}>Confirmed — release with confidence</div>
              <div style={{ fontSize: "1vw", fontWeight: 400, color: "#166534", lineHeight: 1.4 }}>Identity confirmed and child present. Tap Confirm and wish the family a good week.</div>
            </div>
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
