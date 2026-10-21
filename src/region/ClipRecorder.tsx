import { useEffect, useRef, useState } from "react";
/** Records only this game's canvas, never the desktop, microphone, or other tabs. */
export function ClipRecorder({ onStart }: { onStart: () => void }) {
  const alive = useRef(true),
    capture = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      capture.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  function start() {
    const canvas = document.querySelector<HTMLCanvasElement>(
      ".wildlife-root canvas",
    );
    if (!canvas?.captureStream || typeof MediaRecorder === "undefined") {
      setError("Canvas recording is unavailable in this browser.");
      return;
    }
    try {
      const stream = canvas.captureStream(30),
        chunks: BlobPart[] = [];
      capture.current = stream;
      const mime = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : {},
      );
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setUrl(URL.createObjectURL(new Blob(chunks, { type: r.mimeType })));
          setRecording(false);
        }
        recorder.current = null;
      };
      r.start();
      setRecording(true);
      setError("");
      onStart();
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 12000);
    } catch {
      capture.current?.getTracks().forEach((t) => t.stop());
      setError("Recording could not start.");
    }
  }
  return (
    <div className="region-clip">
      <button disabled={recording} onClick={start}>
        {recording ? "Recording 12 seconds…" : "Record 12-second gameplay clip"}
      </button>
      {url && (
        <a href={url} download="afterlight-coast.webm">
          Save gameplay clip
        </a>
      )}
      {error && <small>{error}</small>}
    </div>
  );
}
