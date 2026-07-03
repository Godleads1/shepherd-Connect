export default function Solution() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-[1fr_1fr] grid-rows-[auto_1fr_auto] gap-x-[4vw] gap-y-[4vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="col-span-2 flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>THE SOLUTION</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
          One Platform
        </div>
        <h1 className="text-[3.6vw] font-extrabold m-0 mb-[2vh] leading-[1.1] tracking-tight">
          A digital operations layer for children's ministry
        </h1>
        <p className="text-[1.3vw] font-normal text-slate-600 m-0 leading-relaxed max-w-[38vw]">
          Shepherd Connect replaces clipboards and guesswork with a verified, role-based system covering every step from check-in to pickup.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-[2vh]">
        <div className="flex gap-[1.5vw] items-start bg-white px-[2vw] py-[2vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <div className="w-[1.1vw] h-[1.1vw] rounded-full bg-accent" />
          </div>
          <div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[0.5vh]">OTP-verified delegate pickup</div>
            <div className="text-[0.95vw] text-muted leading-relaxed">One-time codes replace informal verbal handoffs</div>
          </div>
        </div>
        <div className="flex gap-[1.5vw] items-start bg-white px-[2vw] py-[2vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <div className="w-[1.1vw] h-[1.1vw] rounded-full bg-accent" />
          </div>
          <div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[0.5vh]">Six-role access model</div>
            <div className="text-[0.95vw] text-muted leading-relaxed">Super admin, admin, teacher, attendant, and parent each see only what they need</div>
          </div>
        </div>
        <div className="flex gap-[1.5vw] items-start bg-white px-[2vw] py-[2vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <div className="w-[1.1vw] h-[1.1vw] rounded-full bg-accent" />
          </div>
          <div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[0.5vh]">Live attendance and ratios</div>
            <div className="text-[0.95vw] text-muted leading-relaxed">Staffing and incident reporting update in real time</div>
          </div>
        </div>
        <div className="flex gap-[1.5vw] items-start bg-white px-[2vw] py-[2vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <div className="w-[1.1vw] h-[1.1vw] rounded-full bg-accent" />
          </div>
          <div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[0.5vh]">Direct parent communication</div>
            <div className="text-[0.95vw] text-muted leading-relaxed">Notifications and feedback close the loop with families</div>
          </div>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 3</span>
        </div>
      </div>
    </div>
  );
}
