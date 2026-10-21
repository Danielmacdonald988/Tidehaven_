import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() =>
  new URLSearchParams(location.search).has("classic")
    ? import("./App")
    : new URLSearchParams(location.search).has("campaign")
      ? import("./App3D")
      : import("./rescue/RescueApp"),
);
createRoot(document.getElementById("root")!).render(
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
  </Suspense>,
);
