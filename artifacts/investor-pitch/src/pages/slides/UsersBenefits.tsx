export default function UsersBenefits() {
  const roles = [
    {
      title: "Super Admin",
      color: "#1e3a8a",
      textColor: "#ffffff",
      accentColor: "#f59e0b",
      icon: "◆",
      tagline: "Full platform governance",
      benefits: [
        "Approve or reject admin & teacher registrations",
        "Access the full audit trail for compliance",
        "Complete visibility across all families, classes & staff",
      ],
    },
    {
      title: "Admin",
      color: "#1e4fad",
      textColor: "#ffffff",
      accentColor: "#f59e0b",
      icon: "▲",
      tagline: "Command & control",
      benefits: [
        "Manage families, children, classes & teachers",
        "Generate Sunday QR, send broadcasts, log emergencies",
        "Live reports: who's present, who's not picked up, ratio alerts",
      ],
    },
    {
      title: "Teacher",
      color: "#ffffff",
      textColor: "#1d1d1f",
      accentColor: "#1e3a8a",
      icon: "●",
      tagline: "Class management made effortless",
      benefits: [
        "See class roster with allergy alerts before children arrive",
        "Mark attendance & write personalised child appraisals",
        "Clock in/out with a single QR scan — zero paperwork",
      ],
    },
    {
      title: "Attendant",
      color: "#ffffff",
      textColor: "#1d1d1f",
      accentColor: "#1e3a8a",
      icon: "■",
      tagline: "Safe entry & release",
      benefits: [
        "Check children in and out digitally at the kiosk",
        "Verify delegate OTP — no guesswork on who can collect",
        "Allergy alerts surface automatically at every check-in",
      ],
    },
    {
      title: "Parent",
      color: "#f59e0b",
      textColor: "#1d1d1f",
      accentColor: "#1e3a8a",
      icon: "♥",
      tagline: "Peace of mind, every Sunday",
      benefits: [
        "WhatsApp alerts the moment your child checks in or out",
        "Add trusted delegates with a secure one-time OTP",
        "Request class changes, submit feedback, track everything",
      ],
    },
  ];

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[2vh] px-[4vw] py-[4vh] box-border text-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>WHO IT SERVES</div>
          <div>2026</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col justify-center gap-[2vh]">
        <div>
          <div className="text-[1.2vw] font-semibold text-accent mb-[0.8vh] uppercase tracking-widest">
            5 Roles · 1 Platform
          </div>
          <h1 className="text-[3.2vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Every person in your ministry, served
          </h1>
        </div>

        <div className="grid grid-cols-5 gap-[1.2vw]">
          {roles.map((role) => (
            <div
              key={role.title}
              style={{
                backgroundColor: role.color,
                color: role.textColor,
                borderRadius: "1vw",
                padding: "2vh 1.4vw",
                display: "flex",
                flexDirection: "column",
                gap: "1.2vh",
                border: role.color === "#ffffff" ? "1.5px solid #E2E8F0" : "none",
                boxShadow: "0 0.4vw 1.2vw rgba(30,58,138,0.08)",
              }}
            >
              {/* Icon + Title */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.6vw" }}>
                <div
                  style={{
                    width: "2.2vw",
                    height: "2.2vw",
                    backgroundColor: role.accentColor,
                    borderRadius: "0.5vw",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1vw",
                    fontWeight: 900,
                    color: role.color === "#f59e0b" ? "#1d1d1f" : role.color,
                    flexShrink: 0,
                  }}
                >
                  {role.icon}
                </div>
                <div style={{ fontSize: "1.15vw", fontWeight: 800, lineHeight: 1.2 }}>
                  {role.title}
                </div>
              </div>

              {/* Tagline */}
              <div
                style={{
                  fontSize: "0.85vw",
                  fontWeight: 600,
                  opacity: role.color === "#ffffff" ? 0.55 : 0.75,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {role.tagline}
              </div>

              {/* Benefits */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9vh" }}>
                {role.benefits.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "0.6vw",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: "0.4vw",
                        height: "0.4vw",
                        borderRadius: "50%",
                        backgroundColor: role.accentColor,
                        flexShrink: 0,
                        marginTop: "0.5vh",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.9vw",
                        lineHeight: 1.4,
                        opacity: role.color === "#ffffff" ? 0.8 : 0.9,
                      }}
                    >
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 7</span>
        </div>
      </div>
    </div>
  );
}
