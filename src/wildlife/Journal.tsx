import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildCreature } from "./Creatures";
import { SPECIES, type WildlifeState, type SpeciesId } from "./contracts";

/** One shared, low-frequency renderer for six live specimen portraits. */
function Portraits({ state }: { state: WildlifeState }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    if (!canvas.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas.current,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
    renderer.setScissorTest(true);
    const scenes = SPECIES.map((s) => {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight("#f6eed6", "#304d50", 2.6));
      const key = new THREE.DirectionalLight("#fff2d5", 3);
      key.position.set(-2, 4, 3);
      scene.add(key);
      const creature = buildCreature(
        s.id,
        current.current.creatures.find((c) => c.id === s.id)?.variant ?? 0,
      );
      scene.add(creature.group);
      return { scene, creature };
    });
    const silhouette = new THREE.MeshBasicMaterial({ color: "#708882" });
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 20);
    camera.position.set(2.5, 1.8, 3.4);
    camera.lookAt(0, 0.55, 0);
    let frame = 0,
      last = 0;
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (now - last < 65 || !canvas.current) return;
      last = now;
      const box = canvas.current.getBoundingClientRect();
      renderer.setSize(box.width, box.height, false);
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      const cells =
        canvas.current.parentElement?.querySelectorAll<HTMLElement>(
          "[data-portrait]",
        );
      cells?.forEach((cell, i) => {
        const rect = cell.getBoundingClientRect(),
          item = scenes[i];
        const specimen = current.current.creatures.find(
          (c) => c.id === SPECIES[i].id,
        );
        const known = !!specimen?.discovered;
        item.creature.group.rotation.y = now * 0.00015 + i * 0.7;
        item.creature.animate("idle", now / 1000, 0, i);
        item.scene.overrideMaterial = known ? null : silhouette;
        const x = rect.left - box.left,
          y = box.bottom - rect.bottom;
        renderer.setViewport(x, y, rect.width, rect.height);
        renderer.setScissor(x, y, rect.width, rect.height);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        renderer.render(item.scene, camera);
      });
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      scenes.forEach((s) => s.creature.dispose());
      silhouette.dispose();
      renderer.dispose();
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="wild-journal-portraits"
    />
  );
}

export default function Journal({
  state,
  onChoose,
  onClose,
}: {
  state: WildlifeState;
  onChoose: (id: SpeciesId) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(onClose);
  dismiss.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss.current();
      if (e.key === "Tab") {
        const buttons = closeRef.current
          ?.closest("section")
          ?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = buttons?.[0],
          last = buttons?.[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      previous?.focus();
    };
  }, []);
  return (
    <section
      className="wild-journal"
      role="dialog"
      aria-modal="true"
      aria-label="Coastal field journal"
    >
      <style>{`
      .wild-journal{position:fixed;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:min(720px,94vw);max-height:92dvh;overflow:auto;z-index:30;background:rgba(19,39,43,.97);border:1px solid #718c80;border-radius:18px;padding:22px;color:#f1ead6;box-shadow:0 20px 90px #061519a0;font-family:inherit}
      .wild-journal header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px}.wild-journal h2{font-family:Georgia,serif;font-size:28px;margin:0}.wild-journal header p{margin:5px 0;color:#a9c3b5;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
      .wild-journal button{border:1px solid #809b8b;border-radius:30px;background:#314f4f;color:#fff9e8;padding:8px 14px;font:inherit;cursor:pointer}.wild-journal button:focus-visible{outline:3px solid #e8c580;outline-offset:3px}.wild-journal button:disabled{opacity:.6;cursor:default}.wild-journal-grid{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.wild-journal-portraits{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}.wild-journal article{min-width:0;border-bottom:1px solid #547268;padding:0 6px 14px;position:relative}.wild-journal article>*{position:relative;z-index:2}.wild-journal [data-portrait]{height:112px;z-index:0}.wild-journal h3{font-family:Georgia,serif;font-size:21px;margin:0 0 3px}.wild-journal article p{font-size:12px;line-height:1.5;color:#c0cec1;margin:3px 0 8px;min-height:36px}.wild-journal small{display:block;color:#d2b47b;font-size:11px;letter-spacing:.04em}.wild-journal article button{font-size:12px;padding:6px 10px}.wild-journal-foot{font-size:12px;color:#b6c9bb;margin:14px 0 0}
      @media(max-width:540px){.wild-journal{padding:16px}.wild-journal-grid{grid-template-columns:repeat(2,1fr);gap:8px}.wild-journal [data-portrait]{height:90px}.wild-journal h3{font-size:19px}.wild-journal article{padding-bottom:10px}.wild-journal h2{font-size:24px}}
    `}</style>
      <header>
        <div>
          <p>Living coast · field journal</p>
          <h2>Small wonders</h2>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close field journal"
        >
          Close
        </button>
      </header>
      <div className="wild-journal-grid">
        <Portraits state={state} />
        {SPECIES.map((s) => {
          const creature = state.creatures.find((c) => c.id === s.id),
            known = creature?.discovered,
            bonded = creature?.bonded;
          return (
            <article key={s.id}>
              <div
                data-portrait
                aria-label={
                  known ? `${s.name} model` : "Unknown creature silhouette"
                }
              />
              <small>
                {bonded ? "Bonded" : known ? "Encountered" : "Undiscovered"}
              </small>
              <h3>{known ? s.name : "A hidden wonder"}</h3>
              <p>
                {known ? (
                  <>
                    {s.habitat}
                    <br />
                    {s.hint}
                  </>
                ) : (
                  "Listen. Look closer."
                )}
              </p>
              {bonded && (
                <button
                  onClick={() => onChoose(s.id)}
                  disabled={state.companion === s.id}
                >
                  {state.companion === s.id ? "Alongside you" : "Bring along"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="wild-journal-foot">
        {state.creatures.filter((c) => c.bonded).length} of 6 friendships · Your
        discoveries are saved automatically.
      </p>
    </section>
  );
}
