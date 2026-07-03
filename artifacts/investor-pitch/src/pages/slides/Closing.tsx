export default function Closing() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>THANK YOU</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center text-center">
        <div className="w-[6vw] h-[6vw] rounded-full bg-accent/15 flex items-center justify-center mb-[4vh]">
          <div className="w-[3vw] h-[3vw] rounded-full bg-accent" />
        </div>

        <h1 className="text-[5vw] font-extrabold m-0 mb-[2vh] leading-[1.05] tracking-tight">
          Shepherd Connect
        </h1>
        <p className="text-[1.5vw] font-normal text-slate-600 m-0 mb-[6vh] leading-relaxed max-w-[46vw]">
          Safe. Known. Celebrated.
        </p>

        <div className="flex gap-[4vw] px-[6vw] py-[4vh] bg-white rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="text-left">
            <div className="text-[0.9vw] font-semibold text-muted mb-[0.5vh] uppercase">Contact</div>
            <div className="text-[1.2vw] font-semibold text-primary">[Contact information to be added]</div>
          </div>
          <div className="w-[1px] bg-[#E2E8F0]" />
          <div className="text-left">
            <div className="text-[0.9vw] font-semibold text-muted mb-[0.5vh] uppercase">Origin</div>
            <div className="text-[1.2vw] font-semibold text-primary">RCCG City of David</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 10</span>
        </div>
      </div>
    </div>
  );
}
