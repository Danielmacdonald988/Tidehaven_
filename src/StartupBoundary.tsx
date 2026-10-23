import { Component, type ReactNode } from "react";

/** Keep recovery independent of lazy game styles and WebGL. */
export class StartupBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "auto",
          padding: "clamp(24px, 6vw, 64px)",
          background: "#173638",
          color: "#f2e9d2",
          fontFamily: "system-ui, sans-serif",
          lineHeight: 1.6,
        }}
      >
        <h1 style={{ fontFamily: "Georgia, serif" }}>
          The coast couldn’t open.
        </h1>
        <p>A game resource or the graphics renderer could not load.</p>
        <p>
          Try again. If this continues, check that your browser supports WebGL 2
          and that the game’s files are available, or try another browser.
        </p>
        <p>Retrying does not clear your saved progress.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "12px 24px",
            border: "1px solid #f2e9d2",
            borderRadius: 8,
            background: "#f2e9d2",
            color: "#173638",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </main>
    );
  }
}
