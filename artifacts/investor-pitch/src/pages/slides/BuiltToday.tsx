export default function BuiltToday() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg font-body grid grid-cols-1 grid-rows-[auto_1fr_auto] gap-y-[3vh] px-[4vw] py-[4vh] box-border text-primary">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-[2vh]">
        <div className="flex items-center gap-[1vw]">
          <div className="w-[2vw] h-[2vw] bg-accent rounded-[0.4vw]" />
          <div className="text-[1.2vw] font-bold tracking-wide">Shepherd Connect</div>
        </div>
        <div className="flex gap-[2vw] text-[1vw] font-medium text-muted">
          <div>PRODUCT STATUS</div>
          <div>2026</div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-[3vh]">
        <div>
          <div className="text-[1.2vw] font-semibold text-accent mb-[1vh] uppercase tracking-widest">
            Not a Concept
          </div>
          <h1 className="text-[3.6vw] font-extrabold m-0 leading-[1.1] tracking-tight">
            Built and working today
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-[1.5vw]">
          <div className="bg-white px-[1.5vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] text-center shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[3.2vw] font-bold text-primary">8</div>
            <div className="text-[0.95vw] font-semibold text-muted uppercase mt-[0.5vh]">Core Modules</div>
          </div>
          <div className="bg-white px-[1.5vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] text-center shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[3.2vw] font-bold text-primary">6</div>
            <div className="text-[0.95vw] font-semibold text-muted uppercase mt-[0.5vh]">User Roles</div>
          </div>
          <div className="bg-white px-[1.5vw] py-[2.5vh] rounded-[1vw] border border-[#E2E8F0] text-center shadow-[0_0.5vw_1.5vw_rgba(30,58,95,0.05)]">
            <div className="text-[3.2vw] font-bold text-primary">15</div>
            <div className="text-[0.95vw] font-semibold text-muted uppercase mt-[0.5vh]">Data Tables</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-[1vw]">
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Check-in / out</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Attendance</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Classes</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Teachers</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Emergencies</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Reports</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Notifications</div>
          <div className="bg-white px-[1.2vw] py-[1.8vh] rounded-[0.8vw] border border-[#E2E8F0] text-[1vw] font-medium text-slate-700 text-center">Family Profiles</div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-[2vh] text-[0.9vw] text-slate-400 font-medium">
        <div>Shepherd Connect</div>
        <div className="flex gap-[1vw]">
          <span>Confidential</span>
          <span>&bull;</span>
          <span>Page 4</span>
        </div>
      </div>
    </div>
  );
}
