import { useEffect, useRef, useState } from "react";
import { strandProofFallbackMetrics } from "./createStrandProofRenderer";

export default function StrandProofCanvas({
  mode = "desktop",
  focus = "full",
  className = "",
  benchmarkFrames = 0,
  motionPreference = "auto",
  interactionTargetRef,
  diagnosticsKey = "__WEBFOOT_STRAND_PROOF__",
  onMetrics,
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const onMetricsRef = useRef(onMetrics);
  const [ready, setReady] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  onMetricsRef.current = onMetrics;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;
    if (!window.WebGLRenderingContext) {
      const reason = "WebGL unavailable";
      setRuntimeError(reason);
      onMetricsRef.current?.(strandProofFallbackMetrics(reason));
      return undefined;
    }
    let disposed = false;
    let renderer;
    let resizeFrame = 0;
    let resizeObserver;
    let diagnosticsApi;
    let detachPointerInteraction = () => {};
    setReady(false);
    setRuntimeError("");

    import("./createStrandProofRenderer")
      .then(({ createStrandProofRenderer }) => {
        if (disposed) return null;
        return createStrandProofRenderer({
          canvas,
          root,
          mode,
          focus,
          motionPreference,
          onMetrics: (metrics) => { if (!disposed) onMetricsRef.current?.(metrics); },
        });
      })
      .then((instance) => {
        if (!instance) return;
        if (disposed) { instance.dispose(); return; }
        renderer = instance;
        rendererRef.current = instance;
        setReady(true);
        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame) return;
          resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; renderer?.resize(); });
        });
        resizeObserver.observe(root);
        const interactionTarget = interactionTargetRef?.current;
        if (instance.pointerInteractionEnabled && interactionTarget) {
          const handlePointerMove = (event) => {
            if (event.pointerType !== "mouse") return;
            if (instance.pointerMove(event.clientX, event.clientY)) {
              interactionTarget.dataset.strandPointerSamples = String(
                Number(interactionTarget.dataset.strandPointerSamples || 0) + 1,
              );
            }
          };
          const handlePointerLeave = (event) => {
            if (event.pointerType && event.pointerType !== "mouse") return;
            instance.pointerLeave();
          };
          const passive = { passive: true };
          interactionTarget.addEventListener("pointerenter", handlePointerMove, passive);
          interactionTarget.addEventListener("pointermove", handlePointerMove, passive);
          interactionTarget.addEventListener("pointerleave", handlePointerLeave, passive);
          interactionTarget.addEventListener("pointercancel", handlePointerLeave, passive);
          detachPointerInteraction = () => {
            interactionTarget.removeEventListener("pointerenter", handlePointerMove, passive);
            interactionTarget.removeEventListener("pointermove", handlePointerMove, passive);
            interactionTarget.removeEventListener("pointerleave", handlePointerLeave, passive);
            interactionTarget.removeEventListener("pointercancel", handlePointerLeave, passive);
          };
        }
        if (diagnosticsKey) {
          diagnosticsApi = {
            getDiagnostics: () => instance.getDiagnostics(),
            getCanvas: () => canvas,
            benchmark: (frameCount = 90) => instance.benchmark(frameCount),
          };
          window[diagnosticsKey] = diagnosticsApi;
        }
        if (benchmarkFrames > 0) instance.benchmark(benchmarkFrames);
      })
      .catch((error) => {
        if (disposed) return;
        const reason = error?.message || "Strand geometry could not initialise";
        setRuntimeError(reason);
        onMetricsRef.current?.(strandProofFallbackMetrics(reason));
      });

    return () => {
      disposed = true;
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      detachPointerInteraction();
      renderer?.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
      if (diagnosticsKey && window[diagnosticsKey] === diagnosticsApi) delete window[diagnosticsKey];
    };
  }, [benchmarkFrames, diagnosticsKey, focus, interactionTargetRef, mode, motionPreference]);

  return (
    <div ref={rootRef} className={`strand-proof-canvas ${className}`.trim()} data-state={runtimeError ? "fallback" : ready ? "ready" : "loading"}>
      <canvas ref={canvasRef} aria-hidden="true" width="1" height="1" className={ready ? "is-ready" : ""} />
      {!ready && <div className="strand-proof-canvas__status" role="status">{runtimeError || "Building strand ribbons…"}</div>}
    </div>
  );
}
