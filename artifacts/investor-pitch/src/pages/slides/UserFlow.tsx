export default function UserFlow() {
  const steps = [
    {
      time: "Before",
      label: "Setup",
      actor: "Admin",
      actorColor: "#1e3a8a",
      actions: ["Generate Sunday QR code", "Check class staffing ratios"],
    },
    {
      time: "Arrival",
      label: "Clock In",
      actor: "Staff",
      actorColor: "#1e4fad",
      actions: ["Scan QR once → checked in", "Allergy alerts ready at kiosk"],
    },
    {
      time: "Drop-Off",
      label: "Check In",
      actor: "Attendant",
      actorColor: "#0f6cbd",
      actions: ["Child registered digitally", "Parent gets WhatsApp confirmation"],
    },
    {
      time: "Service",
      label: "Class",
      actor: "Teacher",
      actorColor: "#0284c7",
      actions: ["Mark attendance per child", "Write personalised appraisals"],
    },
    {
      time: "End",
      label: "Broadcast",
      actor: "Admin",
      actorColor: "#1e3a8a",
      actions: ["Pre-dismissal WhatsApp blast", "All parents notified to collect"],
    },
    {
      time: "Pickup",
      label: "Check Out",
      actor: "Attendant",
      actorColor: "#0f6cbd",
      actions: ["Parent: direct release", "Delegate: OTP verified release"],
    },
    {
      time: "After",
      label: "Wrap-Up",
      actor: "Admin",
      actorColor: "#1e3a8a",
      actions: ["Not-picked-up live report", "Export CSV · log incidents"],
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
          <div>SUNDAY FLOW</div>
          <div>2026</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col justify-center gap-[2.5vh]">
        <div>
          <div className="text-[1.2vw] font-semibold text-accent mb-[0.8vh] uppercase tracking-widest">
            From setup to sign-off
          </div>
          <h1 className="text-[3.2vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Every role, every step, one Sunday
          </h1>
        </div>

        {/* Timeline */}
        <div className="relative flex items-stretch gap-0">
          {/* Connecting line behind the cards */}
          <div
            style={{
              position: "absolute",
              top: "2.8vw",
              left: "1.8vw",
              right: "1.8vw",
              height: "0.2vw",
              backgroundColor: "#E2E8F0",
              zIndex: 0,
            }}
          />

          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.2vh",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: "2.8vw",
                  height: "2.8vw",
                  borderRadius: "50%",
                  backgroundColor: step.actorColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85vw",
                  fontWeight: 800,
                  color: "#ffffff",
                  border: "0.25vw solid #f8fafc",
                  boxShadow: "0 0.3vw 0.8vw rgba(30,58,138,0.18)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>

              {/* Card */}
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#ffffff",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: "0.8vw",
                  padding: "1.2vh 0.9vw",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.7vh",
                  boxShadow: "0 0.3vw 1vw rgba(30,58,138,0.05)",
                }}
              >
                {/* Time tag */}
                <div
                  style={{
                    fontSize: "0.7vw",
                    fontWeight: 700,
                    color: step.actorColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {step.time}
                </div>

                {/* Label */}
                <div
                  style={{
                    fontSize: "1vw",
                    fontWeight: 800,
                    color: "#1d1d1f",
                    lineHeight: 1.2,
                  }}
                >
                  {step.label}
                </div>

                {/* Actor badge */}
                <div
                  style={{
                    display: "inline-flex",
                    alignSelf: "flex-start",
                    backgroundColor: step.actorColor + "18",
                    color: step.actorColor,
                    fontSize: "0.72vw",
                    fontWeight: 700,
                    padding: "0.2vh 0.5vw",
                    borderRadius: "0.4vw",
                    letterSpacing: "0.04em",
                  }}
                >
                  {step.actor}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
                  {step.actions.map((a, j) => (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.4vw",
                      }}
                    >
                      <div
                        style={{
                          width: "0.3vw",
                          height: "0.3vw",
                          borderRadius: "50%",
                          backgroundColor: "#f59e0b",
                          flexShrink: 0,
                          marginTop: "0.5vh",
                        }}
                      />
                      <span style={{ fontSize: "0.8vw", color: "#475569", lineHeight: 1.4 }}>
                        {a}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp ribbon */}
        <div
          style={{
            backgroundColor: "#1e3a8a",
            borderRadius: "0.8vw",
            padding: "1.2vh 2vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "1vw", fontWeight: 700, color: "#f59e0b" }}>
            WhatsApp runs in parallel throughout every step
          </div>
          <div style={{ display: "flex", gap: "3vw" }}>
            {[
              "Check-in alert to parent",
              "OTP to delegate",
              "Pre-dismissal broadcast",
              "Check-out confirmation",
            ].map((msg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5vw" }}>
                <div
                  style={{
                    width: "0.5vw",
                    height: "0.5vw",
                    borderRadius: "50%",
                    backgroundColor: "#f59e0b",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "0.85vw", color: "rgba(255,255,255,0.8)" }}>{msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 8</span>
        </div>
      </div>
    </div>
  );
}
