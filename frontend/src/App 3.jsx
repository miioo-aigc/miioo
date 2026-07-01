import './App.css'

function App() {
  return (
    <main className="maintenance-page">
      <section className="maintenance-card" aria-label="系统升级提示">
        <div className="status-dot" aria-hidden="true">
          <span className="status-dot__core" />
        </div>

        <h1 className="maintenance-title">系统升级中</h1>

        <p className="maintenance-copy">敬请期待～</p>

        <p className="maintenance-contact">support@ikuncode.cc</p>
      </section>
    </main>
  )
}

export default App
