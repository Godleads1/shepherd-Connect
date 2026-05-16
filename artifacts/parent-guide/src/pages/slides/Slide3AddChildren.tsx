export default function Slide3AddChildren() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#fafafa",
        fontFamily: "'Inter', sans-serif",
        color: "#1d1d1f",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "6vh 7vw",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "1.1vw", fontWeight: 500, color: "#86868b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Shepherd Connect
        </div>
        <div style={{ fontSize: "1.1vw", fontWeight: 400, color: "#86868b" }}>
          Your Family
        </div>
      </div>

      <div style={{ display: "flex", gap: "6vw", alignItems: "center", flex: 1 }}>
        <div style={{ flex: "0 0 42vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: "1vw",
              fontWeight: 600,
              color: "#1e3a8a",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "2vh",
            }}
          >
            Step 2
          </div>
          <h2
            style={{
              fontSize: "4.8vw",
              fontWeight: 200,
              letterSpacing: "-0.04em",
              margin: "0 0 2vh 0",
              lineHeight: 1.1,
            }}
          >
            Add your{" "}
            <span style={{ color: "#1e3a8a", fontWeight: 600 }}>children</span>
          </h2>
          <p
            style={{
              fontSize: "1.75vw",
              fontWeight: 300,
              color: "#86868b",
              letterSpacing: "-0.01em",
              lineHeight: 1.5,
              marginBottom: "4vh",
            }}
          >
            Each child gets their own profile. From the My Family page, tap
            "Add Child" and fill in a few quick details.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.8vh" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Name, date of birth, and gender</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Select the correct class</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
              <div style={{ width: "0.5vw", height: "0.5vw", backgroundColor: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontSize: "1.5vw", fontWeight: 400, color: "#1d1d1f" }}>Note any allergies or medical information</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2.5vh" }}>
          <div
            style={{
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              borderLeft: "0.4vw solid #1e3a8a",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, marginBottom: "0.8vh" }}>Profile</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 300, color: "#86868b" }}>Name, DOB, gender, photo</div>
          </div>
          <div
            style={{
              backgroundColor: "#F5F5F7",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
              borderLeft: "0.4vw solid #1e3a8a",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, marginBottom: "0.8vh" }}>Class assignment</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 300, color: "#86868b" }}>Toddlers, Juniors, Teens</div>
          </div>
          <div
            style={{
              backgroundColor: "#1e3a8a",
              borderRadius: "1.2vw",
              padding: "3vh 2.5vw",
            }}
          >
            <div style={{ fontSize: "1.3vw", fontWeight: 600, color: "#f59e0b", marginBottom: "0.8vh" }}>Medical notes</div>
            <div style={{ fontSize: "1.2vw", fontWeight: 300, color: "rgba(255,255,255,0.7)" }}>Allergy alerts are visible to teachers and attendants at check-in</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1vw", fontWeight: 400, color: "#c7c7cc", letterSpacing: "0.02em" }}>
          Shepherd Connect · Parent Guide
        </div>
        <div style={{ fontSize: "1vw", fontWeight: 500, color: "#86868b" }}>03</div>
      </div>
    </div>
  );
}
