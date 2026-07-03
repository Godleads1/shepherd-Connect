export default function Operations() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>OPERATIONAL DEPTH</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-[3vh]">
        <div>
          <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
            Beyond Check-In
          </div>
          <h1 className="text-[3.6vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Built for the realities of ministry operations
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-[2vw]">
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">Teacher-to-child ratio alerts</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Under-staffed classes are flagged before they become a safety issue</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">Live not-picked-up reports</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Unclaimed children surface instantly with parent contact info</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">Admin approval workflow</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Unverified accounts are kept out of the system by default</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">Class change requests</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Requests route through admin review with a full audit trail</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 6</span>
        </div>
      </div>
    </div>
  );
}
