import { useState } from "react";

export default function HomePage({ onLoginBand, onLoginSinger, onLoginBandView }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [showBandLogin, setShowBandLogin] = useState(false);

  const PASSCODE = "0000";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (passcode !== PASSCODE) {
      setError("Wrong passcode");
      setTimeout(() => setError(""), 1500);
      return;
    }
    onLoginBand();
  };

  const handleNumPad = (digit) => {
    if (passcode.length < 4) {
      setPasscode((v) => v + digit);
    }
  };

  const handleBackspace = () => {
    setPasscode((v) => v.slice(0, -1));
  };

  return (
    <div className="home-page">
      <div className="home-card">
        <div className="home-logo">🎵</div>
        <h1 className="home-title">MasterSheet</h1>
        <p className="home-subtitle">Live Music Sheet Viewer</p>

        {!showBandLogin && (
          <div className="home-mode-select">
            <button className="home-mode-btn singer" onClick={onLoginSinger}>
              <span className="mode-icon">🎤</span>
              <div>
                <span className="mode-label">Singer / Viewer</span>
                <span className="mode-desc">Fullscreen setlist view</span>
              </div>
            </button>
            <button className="home-mode-btn band-viewer" onClick={onLoginBandView}>
              <span className="mode-icon">🎸</span>
              <div>
                <span className="mode-label">Band Viewer</span>
                <span className="mode-desc">View with saved annotations</span>
              </div>
            </button>
            <button className="home-mode-btn band" onClick={() => setShowBandLogin(true)}>
              <span className="mode-icon">🎛️</span>
              <div>
                <span className="mode-label">MasterSheet Control</span>
                <span className="mode-desc">Manage songs & annotate</span>
              </div>
            </button>
          </div>
        )}

        {showBandLogin && (
          <form className="home-login" onSubmit={handleSubmit}>
            <p className="home-login-label">
              Enter passcode for <strong>MasterSheet Control</strong>
            </p>

            <div className="passcode-dots">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`dot ${i < passcode.length ? "filled" : ""} ${error ? "error" : ""}`}
                />
              ))}
            </div>

            {error && <div className="home-error">{error}</div>}

            <div className="numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"].map((key, i) => {
                if (key === null) return <div key={i} className="numpad-spacer" />;
                return (
                  <button
                    key={i}
                    type="button"
                    className="numpad-btn"
                    onClick={() =>
                      key === "⌫" ? handleBackspace() : handleNumPad(String(key))
                    }
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              className="home-enter-btn"
              disabled={passcode.length < 4}
            >
              Enter
            </button>

            <button
              type="button"
              className="home-back-link"
              onClick={() => {
                setShowBandLogin(false);
                setPasscode("");
                setError("");
              }}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
