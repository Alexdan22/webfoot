import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Binary, Focus, Layers3, Smartphone, Waves } from "lucide-react";
import StrandProofCanvas from "@/visuals/webfoot/strand-proof/StrandProofCanvas";
import strandAsset from "./generated/strand-geometry.json";
import "./webfoot-strand-proof.css";

const EMPTY_METRICS = Object.freeze({
  state: "initialising",
  curveCount: strandAsset.counts.curves,
  pointCount: strandAsset.counts.points,
  segmentCount: strandAsset.counts.segments,
  vertexCount: 0,
  drawCalls: 0,
  textures: 0,
  dpr: 0,
  drawingBuffer: { width: 0, height: 0 },
  setupTimeMs: 0,
  renderTimeMs: 0,
  fps: 0,
  benchmarkFrames: 0,
  animationFrames: 0,
  particleCount: 0,
  highlightCount: 0,
  depthBands: 3,
  memory: { geometryBytes: 0, framebufferBytes: 0, estimatedGpuBytes: 0, jsHeapUsedBytes: 0 },
});

const FOCUS_LABELS = Object.freeze({ full: "Full anatomy", toes: "Toe field", arch: "Arch cavity", heel: "Heel hook" });

function metric(value, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function megabytes(value) {
  return Number.isFinite(value) && value > 0 ? `${(value / 1048576).toFixed(2)} MB` : "--";
}

function Metric({ label, value, detail }) {
  return <div className="strand-proof__metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function CaptureView({ mode, focus, size, benchmarkFrames, motionPreference, recordingSeconds }) {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const recordingStartedRef = useRef(false);

  useEffect(() => {
    if (!recordingSeconds || !metrics.motionEnabled || recordingStartedRef.current) return undefined;
    const canvas = document.querySelector(".strand-proof-canvas canvas");
    if (!canvas?.captureStream || typeof MediaRecorder === "undefined") return undefined;
    recordingStartedRef.current = true;
    const cadence = mode === "mobile" ? 30 : 60;
    const stream = canvas.captureStream(cadence);
    const mimeType = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: mode === "mobile" ? 1200000 : 2400000,
    });
    const chunks = [];
    const timer = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, recordingSeconds * 1000);
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `strand-idle-wind-${mode}-${cadence}fps-${recordingSeconds}s.webm`;
      link.dataset.testid = "strand-recording-download";
      link.textContent = "Download native strand recording";
      Object.assign(link.style, { position: "fixed", inset: "0 auto auto 0", width: "1px", height: "1px", opacity: "0.001", zIndex: "9999" });
      document.body.appendChild(link);
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
      document.body.dataset.recording = "complete";
    }, { once: true });
    document.body.dataset.recording = "active";
    recorder.start(250);
    return () => {
      window.clearTimeout(timer);
      if (recorder.state === "recording") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [metrics.motionEnabled, mode, recordingSeconds]);

  return (
    <main className={`strand-proof-capture strand-proof-capture--${mode}`} data-testid="strand-proof-capture" data-focus={focus} style={size}>
      <header><span>Strand geometry proof · runtime</span><strong>{FOCUS_LABELS[focus] || FOCUS_LABELS.full}</strong><span>{metrics.fps ? `${metric(metrics.fps, 1)} FPS · ` : ""}{metrics.curveCount} curves · {metrics.depthBands} depth bands · {mode}</span></header>
      <StrandProofCanvas mode={mode} focus={focus} benchmarkFrames={benchmarkFrames} motionPreference={motionPreference} onMetrics={setMetrics} />
      <output className="strand-proof-capture__diagnostics" data-testid="strand-proof-diagnostics" aria-hidden="true">{JSON.stringify(metrics)}</output>
    </main>
  );
}

export default function WebfootStrandProof() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const capture = query.get("capture") === "implementation";
  const captureMode = query.get("mode") === "mobile" ? "mobile" : "desktop";
  const captureFocus = FOCUS_LABELS[query.get("focus")] ? query.get("focus") : "full";
  const requestedWidth = Number(query.get("width"));
  const requestedHeight = Number(query.get("height"));
  const requestedBenchmarkFrames = Number(query.get("benchmark"));
  const requestedMotion = query.get("motion");
  const requestedRecordingSeconds = Number(query.get("record"));
  const motionPreference = requestedMotion === "static"
    ? "static"
    : requestedMotion === "force"
      ? "force"
      : requestedMotion === "frame"
        ? "frame"
        : "auto";
  const captureWidth = requestedWidth > 0 ? Math.min(1600, Math.max(320, requestedWidth)) : 0;
  const captureHeight = requestedHeight > 0 ? Math.min(1800, Math.max(480, requestedHeight)) : 0;
  const benchmarkFrames = requestedBenchmarkFrames > 0 ? Math.min(180, Math.max(30, requestedBenchmarkFrames)) : 0;
  const recordingSeconds = requestedRecordingSeconds > 0 ? Math.min(10, Math.max(1, requestedRecordingSeconds)) : 0;
  const captureSize = captureWidth && captureHeight ? { width: `${captureWidth}px`, height: `${captureHeight}px`, minHeight: `${captureHeight}px` } : undefined;
  const [preview, setPreview] = useState("desktop");
  const [focus, setFocus] = useState("full");
  const [compactViewport, setCompactViewport] = useState(() => window.innerWidth < 720);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const mode = preview === "mobile" || compactViewport ? "mobile" : "desktop";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Webfoot Strand Geometry Proof";
    const media = window.matchMedia("(max-width: 719px)");
    const handleChange = (event) => setCompactViewport(event.matches);
    media.addEventListener?.("change", handleChange);
    return () => { document.title = previousTitle; media.removeEventListener?.("change", handleChange); };
  }, []);

  if (capture) return <CaptureView mode={captureMode} focus={captureFocus} size={captureSize} benchmarkFrames={benchmarkFrames} motionPreference={motionPreference} recordingSeconds={recordingSeconds} />;

  return (
    <main className={`strand-proof strand-proof--${mode}`} data-testid="webfoot-strand-proof">
      <header className="strand-proof__header">
        <div>
          <p className="strand-proof__eyebrow"><span /> Webfoot / development-only gate</p>
          <h1>Strand geometry proof</h1>
          <p className="strand-proof__lede">Idle-wind shader motion over the approved PNG-authoritative rest geometry. The locked SVG supplies zone labels only; it never clips or reshapes the 1,250 curves.</p>
        </div>
        <div className="strand-proof__contracts">
          <span><Binary size={14} /> Approved + hash locked</span>
          <span><Layers3 size={14} /> Three depth bands</span>
          <span className="is-clean"><Activity size={14} /> 0 runtime textures</span>
        </div>
      </header>

      <div className="strand-proof__workspace">
        <aside className="strand-proof__panel" aria-label="Strand proof controls and diagnostics">
          <section>
            <p className="strand-proof__section-label">Review viewport</p>
            <div className="strand-proof__segmented" role="group" aria-label="Review viewport">
              <button type="button" className={mode === "desktop" ? "is-active" : ""} onClick={() => setPreview("desktop")}><Activity size={14} /> Desktop</button>
              <button type="button" className={mode === "mobile" ? "is-active" : ""} onClick={() => setPreview("mobile")}><Smartphone size={14} /> Mobile</button>
            </div>
            <p className="strand-proof__helper">Independent 60 FPS desktop and gentler DPR-1 / 30 FPS mobile tiers. No pointer field or touch handling.</p>
          </section>

          <section>
            <p className="strand-proof__section-label">Inspection crop</p>
            <div className="strand-proof__focus-grid">
              {Object.entries(FOCUS_LABELS).map(([id, label]) => <button type="button" key={id} className={focus === id ? "is-active" : ""} onClick={() => setFocus(id)}><Focus size={13} /> {label}</button>)}
            </div>
          </section>

          <section>
            <p className="strand-proof__section-label">Geometry</p>
            <div className="strand-proof__metrics">
              <Metric label="Curves" value={metrics.curveCount.toLocaleString()} detail="independent traces" />
              <Metric label="Segments" value={metrics.segmentCount.toLocaleString()} detail={`${metrics.pointCount.toLocaleString()} points`} />
              <Metric label="Draw calls" value={metric(metrics.drawCalls)} detail={`${metrics.textures} textures · ${metrics.geometries || 0} buffers`} />
              <Metric label="Render" value={`${metric(metrics.renderTimeMs, 2)} ms`} detail={`setup ${metric(metrics.setupTimeMs, 1)} ms`} />
              <Metric label="Benchmark" value={metrics.fps ? `${metric(metrics.fps, 1)} FPS` : `${metrics.targetFps || 0} FPS target`} detail={metrics.benchmarkFrames ? `p95 ${metric(metrics.benchmarkFrameIntervalP95Ms, 2)} ms` : metrics.motionEnabled ? "idle wind active" : metrics.fallbackReason} />
              <Metric label="GPU estimate" value={megabytes(metrics.memory?.estimatedGpuBytes)} detail={`${metrics.depthBands} bands · ${metrics.particleCount + metrics.highlightCount} points`} />
            </div>
          </section>

          <section className="strand-proof__distribution">
            <p className="strand-proof__section-label">Curve distribution</p>
            <dl>
              <div><dt>Sole</dt><dd>{strandAsset.counts.byComponent.sole}</dd></div>
              <div><dt>Five toes</dt><dd>{Object.entries(strandAsset.counts.byComponent).filter(([id]) => id.startsWith("toe")).reduce((sum, [, value]) => sum + value, 0)}</dd></div>
              <div><dt>Wake</dt><dd>{strandAsset.counts.byComponent.wake}</dd></div>
              <div><dt>Short / medium / long</dt><dd>{strandAsset.counts.lengthBands.short} / {strandAsset.counts.lengthBands.medium} / {strandAsset.counts.lengthBands.long}</dd></div>
            </dl>
          </section>

          <section className="strand-proof__source">
            <p className="strand-proof__section-label">Source contract</p>
            <p>Guide <code>{strandAsset.sources.artisticGuideSha256.slice(0, 12)}…</code></p>
            <p>Zones <code>{strandAsset.sources.anatomyZonesSha256.slice(0, 12)}…</code></p>
            <p>Curves <code>{strandAsset.freeze.curveDataSha256.slice(0, 12)}…</code></p>
          </section>
        </aside>

        <section className="strand-proof__stage-shell" aria-label="Idle-wind strand geometry implementation">
          <div className="strand-proof__stage-label"><span>implementation / {FOCUS_LABELS[focus]}</span><span className="is-state">{metrics.state}</span></div>
          <StrandProofCanvas mode={mode} focus={focus} motionPreference={motionPreference} onMetrics={setMetrics} />
          <footer><span><Waves size={13} /> Frozen rest curve → depth band → shader wind</span><span>{metrics.drawingBuffer.width} × {metrics.drawingBuffer.height} · DPR {metric(metrics.dpr, 2)}</span></footer>
        </section>
      </div>
    </main>
  );
}
