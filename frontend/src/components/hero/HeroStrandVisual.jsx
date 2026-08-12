import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StrandProofCanvas from "@/visuals/webfoot/strand-proof/StrandProofCanvas";

const MOBILE_TIER_QUERY = "(max-width: 719px), (max-width: 1023px) and (pointer: coarse)";
const REVIEW_TOOLS_ENABLED = process.env.NODE_ENV === "development";

export default function HeroStrandVisual() {
  const wrapperRef = useRef(null);
  const recordingStartedRef = useRef(false);
  const recordingCleanupRef = useRef(() => {});
  const review = useMemo(() => {
    if (!REVIEW_TOOLS_ENABLED) {
      return { benchmarkFrames: 0, recordingSeconds: 0, motionPreference: "auto" };
    }
    const query = new URLSearchParams(window.location.search);
    const requestedBenchmark = Number(query.get("heroBenchmark"));
    const requestedRecording = Number(query.get("heroRecord"));
    const requestedMotion = query.get("heroMotion");
    return {
      benchmarkFrames: requestedBenchmark > 0 ? Math.min(180, Math.max(30, requestedBenchmark)) : 0,
      recordingSeconds: requestedRecording > 0 ? Math.min(10, Math.max(1, requestedRecording)) : 0,
      motionPreference: requestedMotion === "static" ? "static" : "auto",
    };
  }, []);
  const [mode, setMode] = useState(() => (
    window.matchMedia(MOBILE_TIER_QUERY).matches ? "mobile" : "desktop"
  ));

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_TIER_QUERY);
    const updateMode = (event) => setMode(event.matches ? "mobile" : "desktop");
    mobile.addEventListener?.("change", updateMode);
    return () => mobile.removeEventListener?.("change", updateMode);
  }, []);

  useEffect(() => () => recordingCleanupRef.current(), []);

  const handleMetrics = useCallback((metrics) => {
    if (!wrapperRef.current) return;
    wrapperRef.current.dataset.rendererState = metrics.state;
    wrapperRef.current.dataset.motion = metrics.motionEnabled ? "active" : "static";
    if (REVIEW_TOOLS_ENABLED) {
      wrapperRef.current.dataset.diagnostics = JSON.stringify(metrics);
    }
    if (
      !REVIEW_TOOLS_ENABLED
      ||
      !review.recordingSeconds
      || !metrics.motionEnabled
      || metrics.state !== "active"
      || recordingStartedRef.current
      || typeof MediaRecorder === "undefined"
    ) return;
    const canvas = wrapperRef.current.querySelector("canvas");
    if (!canvas?.captureStream) return;
    recordingStartedRef.current = true;
    const requestedCadence = mode === "mobile" ? 30 : 60;
    const stream = canvas.captureStream(requestedCadence);
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: mode === "mobile" ? 1500000 : 3000000,
    });
    const chunks = [];
    const timer = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, review.recordingSeconds * 1000);
    const cleanup = () => {
      window.clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      if (recorder.state === "recording") recorder.stop();
    };
    recordingCleanupRef.current = cleanup;
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `homepage-strand-${mode}-${requestedCadence}fps-${review.recordingSeconds}s.webm`;
      link.dataset.testid = "hero-strand-recording";
      link.textContent = "Download homepage strand recording";
      Object.assign(link.style, {
        position: "fixed",
        inset: "0 auto auto 0",
        width: "1px",
        height: "1px",
        opacity: "0.001",
        zIndex: "9999",
      });
      document.body.appendChild(link);
      const reader = new FileReader();
      reader.addEventListener("loadend", () => {
        const encoded = String(reader.result || "").split(",")[1] || "";
        const chunkSize = 60000;
        for (let offset = 0; offset < encoded.length; offset += chunkSize) {
          const chunk = document.createElement("script");
          chunk.type = "application/octet-stream";
          chunk.dataset.testid = "hero-strand-recording-chunk";
          chunk.textContent = encoded.slice(offset, offset + chunkSize);
          document.body.appendChild(chunk);
        }
        document.body.dataset.strandRecordingMime = blob.type;
        document.body.dataset.strandRecordingBytes = String(blob.size);
        document.body.dataset.strandRecording = "complete";
      }, { once: true });
      reader.readAsDataURL(blob);
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    }, { once: true });
    document.body.dataset.strandRecording = "active";
    recorder.start(250);
  }, [mode, review.recordingSeconds]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      data-testid="hero-strand-module"
      data-renderer-state="loading"
      className="hero-particle-module hero-strand-module"
    >
      <div className="hero-particle-stage hero-strand-stage">
        <StrandProofCanvas
          mode={mode}
          focus={mode === "mobile" ? "heroMobile" : "heroDesktop"}
          benchmarkFrames={review.benchmarkFrames}
          motionPreference={review.motionPreference}
          className="hero-strand-canvas"
          interactionTargetRef={wrapperRef}
          diagnosticsKey={REVIEW_TOOLS_ENABLED ? "__WEBFOOT_HERO_STRANDS__" : null}
          onMetrics={handleMetrics}
        />
      </div>
    </div>
  );
}
