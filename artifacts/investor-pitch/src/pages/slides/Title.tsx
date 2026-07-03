export default function Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-[3fr_2fr] grid-rows-[auto_1fr_auto] gap-x-[4vw] gap-y-[4vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="col-span-2 flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>INVESTOR PITCH</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
          Children's Ministry Operations
        </div>
        <h1 className="text-[5vw] font-extrabold m-0 mb-[2vh] leading-[1.05] tracking-tight text-wrap-balance">
          Shepherd Connect
        </h1>
        <p className="text-[1.5vw] font-normal text-slate-600 m-0 mb-[4vh] leading-relaxed max-w-[40vw] text-wrap-pretty">
          Safe. Known. Celebrated. A full digital operations platform for church children's ministry.
        </p>

        <div className="flex gap-[2vw]">
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] flex-1 shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[0.9vw] font-semibold text-muted mb-[1vh] uppercase">Core Modules</div>
            <div className="text-[3.5vw] font-bold text-primary">8</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] flex-1 shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[0.9vw] font-semibold text-muted mb-[1vh] uppercase">Ministry Roles</div>
            <div className="text-[3.5vw] font-bold text-primary">6</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center">
        <div className="bg-white px-[3vw] py-[4vh] rounded-[1vw] border border-[#E2E8F0] w-full h-full flex flex-col justify-between box-border shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="text-[1.2vw] font-semibold text-primary">The Pickup Chain</div>
          <div className="flex flex-col gap-[3vh] mt-[2vh]">
            <div className="flex items-center gap-[1.5vw]">
              <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[1.1vw]">1</div>
              <div className="text-[1.1vw] font-medium text-slate-700">Child checked in at kiosk</div>
            </div>
            <div className="flex items-center gap-[1.5vw]">
              <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[1.1vw]">2</div>
              <div className="text-[1.1vw] font-medium text-slate-700">Delegate authorized with OTP</div>
            </div>
            <div className="flex items-center gap-[1.5vw]">
              <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-[1.1vw]">3</div>
              <div className="text-[1.1vw] font-medium text-slate-700">Verified release, logged</div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>RCCG City of David</span>
          <span>&bull;</span>
          <span>Confidential</span>
        </div>
      </div>
    </div>
  );
}
