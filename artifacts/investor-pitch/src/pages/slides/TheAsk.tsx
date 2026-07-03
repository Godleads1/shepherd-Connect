export default function TheAsk() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>THE ASK</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center gap-[4vh]">
        <div className="text-center">
          <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
            Seed Funding
          </div>
          <h1 className="text-[3.8vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Raising to move from built to proven
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-[2vw] w-full max-w-[70vw]">
          <div className="bg-white px-[1.8vw] py-[3vh] rounded-[1vw] border border-[#E2E8F0] text-center shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.1vw] font-semibold text-primary mb-[1vh]">Pilot cohort</div>
            <div className="text-[0.95vw] text-slate-600 leading-relaxed">Deploy with a first cohort of churches</div>
          </div>
          <div className="bg-white px-[1.8vw] py-[3vh] rounded-[1vw] border border-[#E2E8F0] text-center shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.1vw] font-semibold text-primary mb-[1vh]">Security hardening</div>
            <div className="text-[0.95vw] text-slate-600 leading-relaxed">Meet child-safety compliance requirements</div>
          </div>
          <div className="bg-white px-[1.8vw] py-[3vh] rounded-[1vw] border border-[#E2E8F0] text-center shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.1vw] font-semibold text-primary mb-[1vh]">Product iteration</div>
            <div className="text-[0.95vw] text-slate-600 leading-relaxed">Build out reporting and communication from pilot feedback</div>
          </div>
        </div>

        <div className="text-[0.95vw] text-slate-500 italic">
          Target raise amount and use-of-funds breakdown to be finalized. [unverified]
        </div>
      </div>

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
