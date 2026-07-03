export default function PickupFlow() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>HOW IT WORKS</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-[4vh]">
        <div className="text-center">
          <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
            Check-In to Pickup
          </div>
          <h1 className="text-[3.4vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Every handoff is verified and logged
          </h1>
        </div>

        <div className="relative flex justify-between items-start px-[1vw]">
          <div className="absolute top-[1.3vw] left-[6vw] right-[6vw] h-[2px] bg-[#E2E8F0]" />

          <div className="relative flex flex-col items-center gap-[2vh] flex-1 z-10">
            <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-primary text-white flex items-center justify-center font-bold text-[1.1vw] border-4 border-bg">1</div>
            <div className="text-[1vw] font-medium text-slate-700 text-center max-w-[12vw]">Parent checks child in at kiosk</div>
          </div>
          <div className="relative flex flex-col items-center gap-[2vh] flex-1 z-10">
            <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-primary text-white flex items-center justify-center font-bold text-[1.1vw] border-4 border-bg">2</div>
            <div className="text-[1vw] font-medium text-slate-700 text-center max-w-[12vw]">Teacher tracks attendance live</div>
          </div>
          <div className="relative flex flex-col items-center gap-[2vh] flex-1 z-10">
            <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent text-white flex items-center justify-center font-bold text-[1.1vw] border-4 border-bg">3</div>
            <div className="text-[1vw] font-medium text-slate-700 text-center max-w-[12vw]">Parent authorizes delegate, one-time code issued</div>
          </div>
          <div className="relative flex flex-col items-center gap-[2vh] flex-1 z-10">
            <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-accent text-white flex items-center justify-center font-bold text-[1.1vw] border-4 border-bg">4</div>
            <div className="text-[1vw] font-medium text-slate-700 text-center max-w-[12vw]">Attendant verifies code before release</div>
          </div>
          <div className="relative flex flex-col items-center gap-[2vh] flex-1 z-10">
            <div className="w-[2.6vw] h-[2.6vw] rounded-full bg-primary text-white flex items-center justify-center font-bold text-[1.1vw] border-4 border-bg">5</div>
            <div className="text-[1vw] font-medium text-slate-700 text-center max-w-[12vw]">Every step logged to the audit trail</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 5</span>
        </div>
      </div>
    </div>
  );
}
