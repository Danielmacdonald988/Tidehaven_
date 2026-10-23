import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { StartupBoundary } from "./StartupBoundary";
import "./fonts.css";
const App = lazy(() =>
  new URLSearchParams(location.search).has("classic")
    ? import("./App")
    : new URLSearchParams(location.search).has("campaign")
      ? import("./App3D")
      : new URLSearchParams(location.search).has("rescue")
        ? import("./rescue/RescueApp")
        : new URLSearchParams(location.search).has("wildlife")
          ? import("./wildlife/App")
          : import("./region/App"),
);
createRoot(document.getElementById("root")!).render(
  <StartupBoundary>
    <Suspense
      fallback={
        <div
          style={{
            background: "#173638",
            color: "#f2e9d2",
            padding: "40px",
            height: "100vh",
            fontFamily: "Georgia",
          }}
        >
          AFTERLIGHT — preparing the neighborhood…
        </div>
      }
    >
      <App />
    </Suspense>
  </StartupBoundary>,
);
