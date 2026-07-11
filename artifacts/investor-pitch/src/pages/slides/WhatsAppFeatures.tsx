export default function WhatsAppFeatures() {
  const outbound = [
    {
      trigger: "Child checked in",
      message: "Temi has been checked in to Juniors class at 9:14 AM.",
    },
    {
      trigger: "Child checked out (parent)",
      message: "Temi has been safely released to you at 11:52 AM.",
    },
    {
      trigger: "Delegate pickup",
      message: "Temi was released to your delegate at 11:48 AM (OTP verified).",
    },
    {
      trigger: "Pre-dismissal broadcast",
      message: "Service is ending — please come collect your child from the Juniors room.",
    },
    {
      trigger: "OTP issued",
      message: "Your delegate pickup code is: 4 8 2 1 9 3 (valid for 24 hours).",
    },
  ];

  const inbound = [
    { cmd: "STATUS", desc: "Returns live status of all registered children" },
    { cmd: "OTP", desc: "Re-sends the active delegate OTP for today" },
    { cmd: "HELP", desc: "Lists all available bot commands" },
    { cmd: "FEEDBACK", desc: "Opens a guided feedback flow in WhatsApp" },
    { cmd: "REMIND ME", desc: "Sets a pre-service reminder for future Sundays" },
    { cmd: "Free text", desc: "AI answers questions like 'What class is David in?' or 'Who picked up Grace?'" },
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
          <div>WHATSAPP CHANNEL</div>
          <div>2026</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col justify-center gap-[2vh]">
        <div>
          <div className="text-[1.2vw] font-semibold text-accent mb-[0.8vh] uppercase tracking-widest">
            98% open rate · zero app downloads required
          </div>
          <h1 className="text-[3.2vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Parents stay informed on the channel they already use
          </h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2vw" }}>
          {/* Outbound */}
          <div
            style={{
              backgroundColor: "#1e3a8a",
              borderRadius: "1vw",
              padding: "2.5vh 2vw",
              display: "flex",
              flexDirection: "column",
              gap: "1.5vh",
            }}
          >
            <div
              style={{
                fontSize: "0.9vw",
                fontWeight: 700,
                color: "#f59e0b",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              ↓ Outbound — Platform sends to parent
            </div>

            {outbound.map((item, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "rgba(255,255,255,0.07)",
                  borderRadius: "0.6vw",
                  padding: "1vh 1.2vw",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4vh",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75vw",
                    fontWeight: 700,
                    color: "rgba(245,158,11,0.85)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {item.trigger}
                </div>
                <div
                  style={{
                    fontSize: "0.9vw",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.88)",
                    lineHeight: 1.4,
                    fontStyle: "italic",
                  }}
                >
                  "{item.message}"
                </div>
              </div>
            ))}
          </div>

          {/* Inbound + stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            {/* Inbound commands */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: "1.5px solid #E2E8F0",
                borderRadius: "1vw",
                padding: "2vh 2vw",
                display: "flex",
                flexDirection: "column",
                gap: "1.2vh",
                boxShadow: "0 0.4vw 1.2vw rgba(30,58,138,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: "0.9vw",
                  fontWeight: 700,
                  color: "#1e3a8a",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                ↑ Inbound — Parent sends to bot
              </div>
              {inbound.map((item, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "flex-start", gap: "1vw" }}
                >
                  <div
                    style={{
                      backgroundColor: "#1e3a8a",
                      color: "#f59e0b",
                      fontSize: "0.75vw",
                      fontWeight: 800,
                      padding: "0.3vh 0.6vw",
                      borderRadius: "0.4vw",
                      flexShrink: 0,
                      letterSpacing: "0.04em",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.cmd}
                  </div>
                  <div
                    style={{
                      fontSize: "0.88vw",
                      color: "#475569",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Why WhatsApp stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1vw" }}>
              {[
                { stat: "98%", label: "Message open rate vs 20% for email" },
                { stat: "2-way", label: "Parents can query live data any time" },
                { stat: "0", label: "Extra apps to download or learn" },
                { stat: "Native", label: "Primary channel for Nigerian families" },
              ].map((card, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: i % 2 === 0 ? "#f59e0b" : "#f8fafc",
                    border: i % 2 === 0 ? "none" : "1.5px solid #E2E8F0",
                    borderRadius: "0.8vw",
                    padding: "1.5vh 1.2vw",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4vh",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.8vw",
                      fontWeight: 900,
                      color: i % 2 === 0 ? "#1e3a8a" : "#1e3a8a",
                      lineHeight: 1,
                    }}
                  >
                    {card.stat}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8vw",
                      color: i % 2 === 0 ? "#1e3a8a" : "#64748b",
                      lineHeight: 1.3,
                    }}
                  >
                    {card.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 9</span>
        </div>
      </div>
    </div>
  );
}
