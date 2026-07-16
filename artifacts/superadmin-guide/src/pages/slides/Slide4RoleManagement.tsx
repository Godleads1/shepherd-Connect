export default function Slide4RoleManagement() {
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
      {/* Subtle background glow */}
      <div style={{ position: "absolute", top: 0, right: 0, width: "40vw", height: "60vh", background: "radial-gradient(ellipse at 90% 10%, rgba(30,58,138,0.5) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ backgroundColor: "rgba(255,255,255,0.05)", borderBottom: "0.1vw solid rgba(255,255,255,0.1)", padding: "2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#f59e0b", letterSpacing: "-0.02em" }}>Role Management</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Super Admin Guide · Shepherd Connect</div>
      </div>

      {/* Intro line */}
      <div style={{ padding: "2.5vh 6vw 0", flexShrink: 0, position: "relative" }}>
        <p style={{ fontSize: "1.3vw", fontWeight: 300, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.5 }}>
          Five roles define what each user can see and do. Only a super admin can assign or change roles.
        </p>
      </div>

      {/* Role cards */}
      <div style={{ flex: 1, display: "flex", gap: "1.2vw", padding: "2.5vh 6vw 2vh", overflow: "hidden", position: "relative" }}>

        <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(245,158,11,0.4)", borderRadius: "1.2vw", padding: "2.2vh 1.6vw", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ fontSize: "0.8vw", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b", marginBottom: "0.3vh" }}>Super Admin</div>
          <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>You</div>
          <div style={{ width: "2vw", height: "0.2vh", backgroundColor: "#f59e0b" }} />
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>Full platform access. Approves all accounts. Can assign any role. Sees audit logs.</div>
        </div>

        <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.12)", borderRadius: "1.2vw", padding: "2.2vh 1.6vw", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ fontSize: "0.8vw", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd", marginBottom: "0.3vh" }}>Admin</div>
          <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>Command Centre</div>
          <div style={{ width: "2vw", height: "0.2vh", backgroundColor: "#93c5fd" }} />
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>Manages families, classes, teachers, check-in, emergencies, reports. Cannot approve accounts.</div>
        </div>

        <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.12)", borderRadius: "1.2vw", padding: "2.2vh 1.6vw", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ fontSize: "0.8vw", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#86efac", marginBottom: "0.3vh" }}>Teacher</div>
          <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>Class View</div>
          <div style={{ width: "2vw", height: "0.2vh", backgroundColor: "#86efac" }} />
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>Sees only their assigned class. Marks attendance, writes appraisals, requests class changes.</div>
        </div>

        <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.12)", borderRadius: "1.2vw", padding: "2.2vh 1.6vw", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ fontSize: "0.8vw", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c4b5fd", marginBottom: "0.3vh" }}>Attendant</div>
          <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>Kiosk Operator</div>
          <div style={{ width: "2vw", height: "0.2vh", backgroundColor: "#c4b5fd" }} />
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>Check-in and checkout only. Verifies OTP delegates. No admin or family access.</div>
        </div>

        <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", border: "0.1vw solid rgba(255,255,255,0.12)", borderRadius: "1.2vw", padding: "2.2vh 1.6vw", display: "flex", flexDirection: "column", gap: "1vh" }}>
          <div style={{ fontSize: "0.8vw", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fda4af", marginBottom: "0.3vh" }}>Parent</div>
          <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>Family Portal</div>
          <div style={{ width: "2vw", height: "0.2vh", backgroundColor: "#fda4af" }} />
          <div style={{ fontSize: "1.05vw", fontWeight: 400, color: "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>Sees only their own family. Adds delegates, submits feedback, views notifications.</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "0.1vw solid rgba(255,255,255,0.1)", padding: "1.2vh 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.3)", letterSpacing: "0.02em" }}>Shepherd Connect · Super Admin Guide · 2026</div>
        <div style={{ fontSize: "0.95vw", color: "rgba(255,255,255,0.4)" }}>shepherdconnect.church</div>
      </div>
    </div>
  );
}
