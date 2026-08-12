import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import strandAsset from "../../../pages/dev/strand-proof/generated/strand-geometry.json";
import {
  buildStrandProofGeometry,
  buildStrandCrawlLookup,
  canUseStrandPointerInteraction,
  resolveStrandMotionCapability,
  resolveStrandPresentation,
  resolveStrandWakeupEnabled,
  isStrandWakeupSettled,
  strandWakeupPhase,
  strandWakeupProgress,
  STRAND_DESKTOP_PRESENTATION,
  STRAND_MOBILE_PRESENTATION,
  STRAND_POINTER_REPULSION_PROFILE,
  STRAND_WAKEUP_PROFILE,
} from "./createStrandProofRenderer";
import {
  strandProofFragmentShader,
  strandProofPointVertexShader,
  strandProofVertexShader,
} from "./strandProofShaders";

describe("approved strand geometry runtime lock", () => {
  test("keeps the approved curve records byte-stable", () => {
    const digest = createHash("sha256").update(JSON.stringify(strandAsset.curves)).digest("hex");
    expect(strandAsset.status).toBe("approved-frozen");
    expect(strandAsset.counts.curves).toBe(1250);
    expect(strandAsset.counts.points).toBe(26158);
    expect(digest).toBe("052daf8b75d244b366b2ce407c9e65f297fad27ea35d8e47449a02c54bd5cfcd");
  });

  test("batches all approved curves across exactly three rendering bands", () => {
    const built = buildStrandProofGeometry(strandAsset);
    const bands = new Set(Array.from(built.geometry.getAttribute("aDepth").array));
    expect(built.segmentCount).toBe(24908);
    expect(built.vertexCount).toBe(52316);
    expect(bands).toEqual(new Set([0, 1, 2]));
    built.geometry.dispose();
  });

  test("adds deterministic motion metadata without changing rest positions or widths", () => {
    const first = buildStrandProofGeometry(strandAsset);
    const second = buildStrandProofGeometry(strandAsset);
    const expectedVertices = 52316;
    for (const name of ["aPhase", "aBundlePhase", "aFlexibility", "aDepth", "aArcPosition"]) {
      expect(first.geometry.getAttribute(name).count).toBe(expectedVertices);
      expect(Array.from(first.geometry.getAttribute(name).array.slice(0, 64)))
        .toEqual(Array.from(second.geometry.getAttribute(name).array.slice(0, 64)));
    }
    expect(Array.from(first.geometry.getAttribute("position").array))
      .toEqual(Array.from(second.geometry.getAttribute("position").array));
    expect(Array.from(first.geometry.getAttribute("aWidth").array))
      .toEqual(Array.from(second.geometry.getAttribute("aWidth").array));
    first.geometry.dispose();
    second.geometry.dispose();
  });

  test("keeps timing related inside bundles without encoding opposing travel directions", () => {
    const built = buildStrandProofGeometry(strandAsset);
    const phases = built.geometry.getAttribute("aPhase").array;
    const bundlePhases = built.geometry.getAttribute("aBundlePhase").array;
    const timingOffsets = new Set(Array.from(phases, (phase, index) => phase >= bundlePhases[index] ? 1 : -1));
    expect(timingOffsets).toEqual(new Set([-1, 1]));
    for (let index = 0; index < Math.min(512, phases.length); index += 2) {
      expect(Math.abs(phases[index] - bundlePhases[index])).toBeLessThanOrEqual(0.171);
    }
    built.geometry.dispose();
  });

  test("enables pointer response only for animated desktop fine pointers", () => {
    const finePointer = { finePointer: true, hover: true };
    expect(canUseStrandPointerInteraction({ mode: "desktop", hints: finePointer })).toBe(true);
    expect(canUseStrandPointerInteraction({ mode: "mobile", hints: finePointer })).toBe(false);
    expect(canUseStrandPointerInteraction({ mode: "desktop", motionEnabled: false, hints: finePointer })).toBe(false);
    expect(canUseStrandPointerInteraction({ mode: "desktop", hints: { finePointer: false, hover: false } })).toBe(false);
  });

  test("keeps pointer deformation outward-only with a damped trailing pressure field", () => {
    expect(STRAND_POINTER_REPULSION_PROFILE.mode).toBe("elliptical-outward-repulsion");
    expect(STRAND_POINTER_REPULSION_PROFILE.recoverySeconds).toBeGreaterThanOrEqual(1.5);
    expect(STRAND_POINTER_REPULSION_PROFILE.recoverySeconds).toBeLessThanOrEqual(2.2);
    expect(STRAND_POINTER_REPULSION_PROFILE.trailFollowRate)
      .toBeLessThan(STRAND_POINTER_REPULSION_PROFILE.positionFollowRate);
    expect(STRAND_POINTER_REPULSION_PROFILE.releaseDelayMs).toBeGreaterThanOrEqual(150);
    expect(STRAND_POINTER_REPULSION_PROFILE.wakeClamp).toBeLessThan(1);
    expect(STRAND_POINTER_REPULSION_PROFILE.wakeClamp)
      .toBeGreaterThan(STRAND_POINTER_REPULSION_PROFILE.coreClamp);
    expect(strandProofVertexShader).toContain("pressureVector -= currentRadialOut * min(0.0");
    expect(strandProofVertexShader).toContain("uPointerTrailPosition");
    expect(strandProofVertexShader).not.toContain("pointerOffset = pointerDirection");
    expect(strandProofFragmentShader).toContain("displacedOuterEdge");
  });

  test("applies scale and counter-clockwise rotation only to the desktop hero presentation", () => {
    expect(resolveStrandPresentation({ mode: "desktop", focus: "heroDesktop" }))
      .toBe(STRAND_DESKTOP_PRESENTATION);
    expect(STRAND_DESKTOP_PRESENTATION.scale).toBeGreaterThanOrEqual(1.1);
    expect(STRAND_DESKTOP_PRESENTATION.scale).toBeLessThanOrEqual(1.15);
    expect(STRAND_DESKTOP_PRESENTATION.rotationDegrees).toBeGreaterThanOrEqual(4);
    expect(STRAND_DESKTOP_PRESENTATION.rotationDegrees).toBeLessThanOrEqual(7);
    expect(resolveStrandPresentation({ mode: "mobile", focus: "heroMobile" }))
      .toBe(STRAND_MOBILE_PRESENTATION);
    expect(STRAND_MOBILE_PRESENTATION.scale).toBeGreaterThanOrEqual(1.15);
    expect(STRAND_MOBILE_PRESENTATION.scale).toBeLessThanOrEqual(1.3);
    expect(STRAND_MOBILE_PRESENTATION.rotationDegrees).toBeGreaterThanOrEqual(3);
    expect(STRAND_MOBILE_PRESENTATION.rotationDegrees).toBeLessThanOrEqual(6);
    expect(resolveStrandPresentation({ mode: "desktop", focus: "full" }))
      .toEqual({ scale: 1, rotationDegrees: 0 });
    expect(strandProofVertexShader).toContain("uMotionCoherence");
    expect(strandProofVertexShader).toContain("uPresentationRotation");
  });

  test("runs one normalized wake-up only for the animated desktop hero", () => {
    expect(STRAND_WAKEUP_PROFILE.mode).toBe("geometry-crawl");
    expect(STRAND_WAKEUP_PROFILE.durationSeconds).toBeGreaterThanOrEqual(1.65);
    expect(STRAND_WAKEUP_PROFILE.durationSeconds).toBeLessThanOrEqual(1.75);
    expect(resolveStrandWakeupEnabled({ mode: "desktop", focus: "heroDesktop" })).toBe(true);
    expect(resolveStrandWakeupEnabled({ mode: "mobile", focus: "heroMobile" })).toBe(true);
    expect(resolveStrandWakeupEnabled({ mode: "desktop", focus: "heroDesktop", motionEnabled: false })).toBe(false);
    expect(strandWakeupProgress(0, true)).toBe(0);
    expect(strandWakeupProgress(STRAND_WAKEUP_PROFILE.durationSeconds, true)).toBe(1);
    expect(strandWakeupProgress(0, false)).toBe(1);
    expect(strandWakeupPhase(0)).toBe("gathered-lower-fibres");
    expect(strandWakeupPhase(1)).toBe("settled");
    expect(isStrandWakeupSettled(STRAND_WAKEUP_PROFILE.cursorReadyProgress - 0.001)).toBe(false);
    expect(isStrandWakeupSettled(STRAND_WAKEUP_PROFILE.cursorReadyProgress)).toBe(true);
    expect(strandProofVertexShader).toContain("uWakeupProgress");
    expect(strandProofVertexShader).toContain("sampleCrawlCurve");
    expect(strandProofVertexShader).toContain("crawlCurvePoint");
    expect(strandProofVertexShader).toContain("return crawledPoint + idleOffset + pointerOffset");
    expect(strandProofVertexShader).not.toContain("wakeupOffset");
    expect(strandProofFragmentShader).toContain("vCrawlSettled");
    expect(strandProofPointVertexShader).toContain("aCrawlData");
  });

  test("derives deterministic actual-arc crawl lookup without changing canonical attributes", () => {
    const first = buildStrandCrawlLookup(strandAsset, 64);
    const second = buildStrandCrawlLookup(strandAsset, 64);
    expect(first.width).toBe(64);
    expect(first.height).toBe(1250);
    expect(first.byteLength).toBe(64 * 1250 * 4 * Float32Array.BYTES_PER_ELEMENT);
    expect(Array.from(first.data)).toEqual(Array.from(second.data));
    for (let curveIndex = 0; curveIndex < first.height; curveIndex += 1) {
      const firstOffset = curveIndex * first.width * 4;
      const lastOffset = firstOffset + (first.width - 1) * 4;
      expect(first.data[firstOffset + 1]).toBeLessThanOrEqual(first.data[lastOffset + 1] + 0.000001);
    }
    const built = buildStrandProofGeometry(strandAsset);
    const rebuilt = buildStrandProofGeometry(strandAsset);
    expect(Array.from(built.geometry.getAttribute("position").array.slice(0, 256)))
      .toEqual(Array.from(rebuilt.geometry.getAttribute("position").array.slice(0, 256)));
    built.geometry.dispose();
    rebuilt.geometry.dispose();
  });

  test("keeps every legacy footprint node out of the active strand loading path", () => {
    const heroSource = readFileSync(resolve(__dirname, "../../../components/Hero.jsx"), "utf8");
    const strandHeroSource = readFileSync(resolve(__dirname, "../../../components/hero/HeroStrandVisual.jsx"), "utf8");
    expect(heroSource).toContain("<Suspense fallback={null}>");
    expect(heroSource).toContain('process.env.REACT_APP_WEBFOOT_STRAND_HERO !== "0"');
    expect(heroSource).not.toContain('process.env.NODE_ENV === "development"\n  && process.env.REACT_APP_WEBFOOT_STRAND_HERO');
    expect(heroSource).not.toContain('import HeroParticleVisual from');
    expect(heroSource).toContain('lazy(() => import("@/components/hero/HeroParticleVisual"))');
    expect(strandHeroSource).not.toContain("FootprintFallback");
    expect(strandHeroSource).not.toContain("hero-particle-static-fallback");
    expect(strandHeroSource).toContain('const REVIEW_TOOLS_ENABLED = process.env.NODE_ENV === "development"');
  });

  test.each([
    [{ reducedMotion: true, saveData: false, hardwareConcurrency: 8, deviceMemory: 8 }, "prefers-reduced-motion"],
    [{ reducedMotion: false, saveData: true, hardwareConcurrency: 8, deviceMemory: 8 }, "Save-Data enabled"],
    [{ reducedMotion: false, saveData: false, hardwareConcurrency: 4, deviceMemory: 8 }, "Weak-device static tier"],
    [{ reducedMotion: false, saveData: false, hardwareConcurrency: 8, deviceMemory: 4 }, "Weak-device static tier"],
  ])("keeps accessibility and weak-device paths static", (hints, reason) => {
    expect(resolveStrandMotionCapability({ hints })).toEqual({ enabled: false, reason });
  });
});
