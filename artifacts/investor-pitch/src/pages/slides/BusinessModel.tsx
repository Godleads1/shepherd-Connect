export default function BusinessModel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-[1fr_1fr] grid-rows-[auto_1fr_auto] gap-x-[4vw] gap-y-[4vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="col-span-2 flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>BUSINESS MODEL</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
          Path to Revenue
        </div>
        <h1 className="text-[3.4vw] font-extrabold m-0 mb-[2vh] leading-[1.1] tracking-tight">
          Two routes to market, pricing in progress
        </h1>
        <p className="text-[1vw] font-normal text-slate-500 m-0 leading-relaxed max-w-[36vw] italic">
          Pricing has not been finalized. [unverified]
        </p>
      </div>

      <div className="flex flex-col justify-center gap-[2vh]">
        <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="text-[0.95vw] font-semibold text-accent uppercase tracking-widest mb-[1vh]">Option A</div>
          <div className="text-[1.3vw] font-semibold text-primary mb-[1vh]">Per-church subscription</div>
          <div className="text-[1vw] text-slate-600 leading-relaxed">Tiered by congregation size, sold directly to individual churches</div>
        </div>
        <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
          <div className="text-[0.95vw] font-semibold text-accent uppercase tracking-widest mb-[1vh]">Option B</div>
          <div className="text-[1.3vw] font-semibold text-primary mb-[1vh]">Network licensing</div>
          <div className="text-[1vw] text-slate-600 leading-relaxed">Denomination or multi-campus deployments licensed at the network level</div>
        </div>
        <div className="bg-primary/5 px-[2vw] py-[2vh] rounded-[1vw] border border-primary/10">
          <div className="text-[0.9vw] font-semibold text-muted uppercase mb-[0.5vh]">Early Target</div>
          <div className="text-[1.05vw] text-slate-700 leading-relaxed">Mid-to-large congregations already running structured children's ministry programs</div>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
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
