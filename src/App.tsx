import "./App.css";

function App() {
  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Noya Explorer</p>
        <h1>Explore your files smarter.</h1>
        <p className="subtitle">
          A lightweight file explorer focused on clarity, storage insights and
          suspicious file detection.
        </p>

        <div className="actions">
          <button>Choose folder</button>
          <button className="secondary">View roadmap</button>
        </div>
      </section>

      <section className="dashboard">
        <div className="card">
          <span className="label">Files scanned</span>
          <strong>0</strong>
        </div>

        <div className="card">
          <span className="label">Total size</span>
          <strong>0 MB</strong>
        </div>

        <div className="card">
          <span className="label">Suspicious files</span>
          <strong>0</strong>
        </div>
      </section>

      <section className="panel">
        <h2>First prototype goal</h2>
        <p>
          The first version will scan a selected folder, list files, detect file
          extensions and calculate basic storage statistics.
        </p>
      </section>
    </main>
  );
}

export default App;
