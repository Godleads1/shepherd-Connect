export default function Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>THE PROBLEM</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-[3vh]">
        <div>
          <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
            Children's Ministry Today
          </div>
          <h1 className="text-[4vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Child safety runs on paper and trust
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-[2vw]">
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.2vw] font-semibold text-primary mb-[1vh]">No verified chain of custody</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Any adult can claim a child at pickup, with no verification step</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.2vw] font-semibold text-primary mb-[1vh]">Paper-based tracking</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Check-in and pickup logs sit on clipboards and spreadsheets</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.2vw] font-semibold text-primary mb-[1vh]">No operational visibility</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Admins and teachers cannot see attendance trends or class ratios</div>
          </div>
          <div className="bg-white px-[2vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[1.2vw] font-semibold text-primary mb-[1vh]">No parent feedback loop</div>
            <div className="text-[1vw] text-slate-600 leading-relaxed">Parents get no record of their child's day, no notifications</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 2</span>
        </div>
      </div>
    </div>
  );
}
