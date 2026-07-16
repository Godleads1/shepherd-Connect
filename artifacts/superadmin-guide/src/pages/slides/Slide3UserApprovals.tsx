export default function Slide3UserApprovals() {
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
      {/* Top bar */}
      <div style={{ backgroundColor: "#1e3a8a", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>User Approvals</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", gap: "3vw", padding: "3vh 6vw 2.5vh", overflow: "hidden" }}>

        {/* Left: how it works */}
        <div style={{ flex: "0 0 38vw", display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div>
            <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5vh" }}>How approvals work</div>
            <p style={{ fontSize: "1.2vw", fontWeight: 400, color: "#374151", lineHeight: 1.55, margin: 0 }}>
              When an admin or teacher registers, their account is set to{" "}
              <span style={{ fontWeight: 700, color: "#f59e0b", backgroundColor: "#fef3c7", padding: "0.1vh 0.4vw", borderRadius: "0.3vw" }}>pending_approval</span>
              {" "}and they cannot log in until you act. Parents self-serve instantly.
            </p>
          </div>

          {/* Workflow steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>1</div>
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Go to Users page</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Select the "Pending Approval" tab to see all accounts awaiting review</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>2</div>
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Review the registration</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Check name, email, and role — confirm this is a known church volunteer</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2vw" }}>
              <div style={{ width: "3.2vw", height: "3.2vw", backgroundColor: "#1e3a8a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#f59e0b" }}>3</div>
              </div>
              <div>
                <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#1d1d1f", marginBottom: "0.3vh" }}>Approve or Reject</div>
                <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#64748b", lineHeight: 1.4 }}>Approved users get active status and can log in immediately</div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "0.1vw", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

        {/* Right: status reference */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontSize: "0.85vw", fontWeight: 700, color: "#86868b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Account status guide</div>

          <div style={{ backgroundColor: "#fef3c7", border: "0.1vw solid #fde68a", borderRadius: "0.8vw", padding: "1.8vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.5vw", flexShrink: 0, alignSelf: "stretch", backgroundColor: "#f59e0b", borderRadius: "0.3vw" }} />
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#92400e", marginBottom: "0.4vh" }}>pending_approval</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#78350f", lineHeight: 1.4 }}>Registered but blocked from logging in. Appears in the Pending tab.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#dcfce7", border: "0.1vw solid #86efac", borderRadius: "0.8vw", padding: "1.8vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.5vw", flexShrink: 0, alignSelf: "stretch", backgroundColor: "#16a34a", borderRadius: "0.3vw" }} />
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#14532d", marginBottom: "0.4vh" }}>active</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#166534", lineHeight: 1.4 }}>Approved and able to log in. Full access per their assigned role.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#fee2e2", border: "0.1vw solid #fca5a5", borderRadius: "0.8vw", padding: "1.8vh 1.5vw", display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
            <div style={{ width: "0.5vw", flexShrink: 0, alignSelf: "stretch", backgroundColor: "#dc2626", borderRadius: "0.3vw" }} />
            <div>
              <div style={{ fontSize: "1.2vw", fontWeight: 700, color: "#7f1d1d", marginBottom: "0.4vh" }}>rejected / inactive</div>
              <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "#991b1b", lineHeight: 1.4 }}>Account denied or deactivated. Login blocked. Reversible by super admin.</div>
            </div>
          </div>

          <div style={{ backgroundColor: "#f0f4ff", border: "0.1vw solid #c7d2fe", borderRadius: "0.8vw", padding: "1.4vh 1.5vw", marginTop: "auto" }}>
            <div style={{ fontSize: "1vw", fontWeight: 600, color: "#3730a3", marginBottom: "0.4vh" }}>Note</div>
            <div style={{ fontSize: "1vw", fontWeight: 400, color: "#4338ca", lineHeight: 1.4 }}>You can also change a user's role (e.g. teacher → admin) from their profile at any time.</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: "#1e3a8a", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.5)", letterSpacing: "0.02em" }}>Shepherd Connect · Super Admin Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.6)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
