export default function WhyNow() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>WHY NOW</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-[3vh]">
        <div className="text-center">
          <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
            Timing
          </div>
          <h1 className="text-[3.6vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            The market is shifting, children's ministry is behind
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-[2vw]">
          <div className="bg-white px-[2vw] py-[3vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="w-[3vw] h-[3vw] rounded-full bg-accent/15 flex items-center justify-center mb-[2vh]">
              <div className="w-[1.3vw] h-[1.3vw] rounded-full bg-accent" />
            </div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">Rising scrutiny</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Church child-safety policies are under increasing formal review</div>
          </div>
          <div className="bg-white px-[2vw] py-[3vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="w-[3vw] h-[3vw] rounded-full bg-accent/15 flex items-center justify-center mb-[2vh]">
              <div className="w-[1.3vw] h-[1.3vw] rounded-full bg-accent" />
            </div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">Digitization lag</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Ministries have digitized adult-facing operations, children's ministry has not kept pace</div>
          </div>
          <div className="bg-white px-[2vw] py-[3vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="w-[3vw] h-[3vw] rounded-full bg-accent/15 flex items-center justify-center mb-[2vh]">
              <div className="w-[1.3vw] h-[1.3vw] rounded-full bg-accent" />
            </div>
            <div className="text-[1.15vw] font-semibold text-primary mb-[1vh]">An afterthought module</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Existing church management systems treat children's ministry as secondary, not core</div>
          </div>
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
