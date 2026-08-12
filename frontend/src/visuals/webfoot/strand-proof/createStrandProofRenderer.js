import * as THREE from "three";
import strandAsset from "../../../pages/dev/strand-proof/generated/strand-geometry.json";
import {
  strandProofFragmentShader,
  strandProofPointFragmentShader,
  strandProofPointVertexShader,
  strandProofVertexShader,
} from "./strandProofShaders";

const APPROVED_CURVE_COUNT = 1250;
const APPROVED_POINT_COUNT = 26158;
const APPROVED_CURVE_DATA_SHA256 = "052daf8b75d244b366b2ce407c9e65f297fad27ea35d8e47449a02c54bd5cfcd";

const RENDER_TIERS = Object.freeze({
  desktop: Object.freeze({
    antialias: true,
    dprMax: 1.5,
    powerPreference: "high-performance",
    widthScale: 0.36,
    minPixelWidth: 0.52,
    depthStrength: 0.007,
    baseAlpha: 1.92,
    glowWidth: 4.8,
    glowAlpha: 0.155,
    ribbonLuminance: 7.5,
    haloLuminance: 6.0,
    pointLuminance: 1.8,
    particles: 760,
    freeParticleRatio: 0.46,
    freeParticleTravel: 0.105,
    highlights: 68,
    highlightSpacing: 0.027,
    targetFps: 60,
    motionAmplitude: 0.00235,
    motionSpeed: 0.46,
    motionCoherence: 1,
    pointerRadius: 0.19,
    pointerAmplitude: 0.032,
  }),
  mobile: Object.freeze({
    antialias: false,
    dprMax: 1,
    powerPreference: "low-power",
    widthScale: 0.41,
    minPixelWidth: 0.58,
    depthStrength: 0.005,
    baseAlpha: 1.48,
    glowWidth: 3.8,
    glowAlpha: 0.09,
    ribbonLuminance: 3.0,
    haloLuminance: 1.8,
    pointLuminance: 1.35,
    particles: 260,
    freeParticleRatio: 0.4,
    freeParticleTravel: 0.078,
    highlights: 32,
    highlightSpacing: 0.038,
    targetFps: 30,
    motionAmplitude: 0.0013,
    motionSpeed: 0.34,
    motionCoherence: 0,
    pointerRadius: 0,
    pointerAmplitude: 0,
  }),
});

export const STRAND_POINTER_REPULSION_PROFILE = Object.freeze({
  mode: "elliptical-outward-repulsion",
  maxVelocity: 0.56,
  fullStrengthVelocity: 0.42,
  releaseDelayMs: 180,
  positionFollowRate: 16,
  trailFollowRate: 6.2,
  velocityFollowRate: 12,
  targetAttackRate: 10,
  targetReleaseRate: 4.2,
  riseOmega: 11.5,
  recoveryOmega: 2.75,
  recoverySeconds: 2,
  trailWeight: 0.38,
  longitudinalRadius: [1.04, 1.32],
  lateralRadius: [0.76, 0.84],
  coreClamp: 0.52,
  wakeClamp: 0.96,
  toeClampMultiplier: 0.42,
});

export const STRAND_DESKTOP_PRESENTATION = Object.freeze({
  scale: 1.12,
  rotationDegrees: 5,
});

export const STRAND_MOBILE_PRESENTATION = Object.freeze({
  scale: 1.22,
  rotationDegrees: 4.5,
  translation: Object.freeze([0.075, -0.045]),
});

export const STRAND_WAKEUP_PROFILE = Object.freeze({
  mode: "geometry-crawl",
  durationSeconds: 1.7,
  cursorReadyProgress: 0.92,
  lookupSamples: 64,
  transitionWidth: 0.12,
  compactedLengthRatio: 0.045,
});

const REVIEW_FOCUS = Object.freeze({
  toes: Object.freeze({ center: [0.7, 0.78], scale: 1.3 }),
  heroDesktop: Object.freeze({ center: [0.56, 0.5], scale: 1.3 }),
  heroMobile: Object.freeze({ center: [0.5, 0.5], scale: 1.3 }),
});

export function resolveStrandPresentation({ mode = "desktop", focus = "full" } = {}) {
  if (mode === "desktop" && focus === "heroDesktop") return STRAND_DESKTOP_PRESENTATION;
  if (mode === "mobile" && focus === "heroMobile") return STRAND_MOBILE_PRESENTATION;
  return { scale: 1, rotationDegrees: 0 };
}

export function resolveStrandWakeupEnabled({
  mode = "desktop",
  focus = "full",
  motionEnabled = true,
  captureFrame = false,
} = {}) {
  const homepageHero = (mode === "desktop" && focus === "heroDesktop")
    || (mode === "mobile" && focus === "heroMobile");
  return homepageHero && motionEnabled && !captureFrame;
}

export function strandWakeupProgress(activeTime, enabled = true) {
  if (!enabled) return 1;
  return clamp(activeTime / STRAND_WAKEUP_PROFILE.durationSeconds, 0, 1);
}

export function strandWakeupPhase(progress) {
  if (progress >= 1) return "settled";
  if (progress >= 1.45 / STRAND_WAKEUP_PROFILE.durationSeconds) return "settling-idle";
  if (progress >= 1.1 / STRAND_WAKEUP_PROFILE.durationSeconds) return "wake-crawl-release";
  if (progress >= 0.8 / STRAND_WAKEUP_PROFILE.durationSeconds) return "toe-resolution";
  if (progress >= 0.45 / STRAND_WAKEUP_PROFILE.durationSeconds) return "sole-arch-crawl";
  if (progress >= 0.15 / STRAND_WAKEUP_PROFILE.durationSeconds) return "lower-fibre-crawl";
  return "gathered-lower-fibres";
}

export function isStrandWakeupSettled(progress) {
  return progress >= STRAND_WAKEUP_PROFILE.cursorReadyProgress;
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const fract = (value) => value - Math.floor(value);
const hash01 = (value, salt = 0) => fract(Math.sin(value * 127.1 + salt * 311.7) * 43758.5453123);

function validateApprovedAsset(asset) {
  const pointCount = asset.curves.reduce((sum, curve) => sum + curve.points.length / 2, 0);
  if (
    asset.status !== "approved-frozen"
    || asset.counts.curves !== APPROVED_CURVE_COUNT
    || asset.counts.points !== APPROVED_POINT_COUNT
    || asset.curves.length !== APPROVED_CURVE_COUNT
    || pointCount !== APPROVED_POINT_COUNT
    || asset.freeze?.curveDataSha256 !== APPROVED_CURVE_DATA_SHA256
  ) {
    throw new Error("The approved PNG-authoritative strand snapshot failed its runtime lock.");
  }
}

function curveBand(curve, curveIndex) {
  const value = hash01(curveIndex + 1, 17);
  if (curve.kind === "wake") return value < 0.58 ? 0 : value < 0.9 ? 1 : 2;
  if (curve.colour >= 2) return value < 0.08 ? 0 : value < 0.57 ? 1 : 2;
  return value < 0.18 ? 0 : value < 0.74 ? 1 : 2;
}

function componentSeed(component = "") {
  let value = 0;
  for (let index = 0; index < component.length; index += 1) value = (value * 31 + component.charCodeAt(index)) % 65521;
  return value;
}

function curveMotionProfile(curve, curveIndex, depth) {
  const variability = hash01(curveIndex + 1, 43);
  const baseFlexibility = curve.kind === "wake" ? 0.72 : curve.kind === "toe" ? 0.3 : 0.38;
  const flexibilityRange = curve.kind === "wake" ? 0.25 : curve.kind === "toe" ? 0.18 : 0.2;
  const pointCount = curve.points.length / 2;
  const startX = curve.points[0] || 0;
  const startY = curve.points[1] || 0;
  const midpointIndex = Math.max(0, Math.floor(pointCount * 0.5) * 2);
  const midpointX = curve.points[midpointIndex] || startX;
  const midpointY = curve.points[midpointIndex + 1] || startY;
  const spatialBundle = Math.floor(midpointX * 9) + Math.floor(midpointY * 11) * 9;
  const resolvedBundlePhase = hash01(componentSeed(curve.component) + spatialBundle + 1, 47) * Math.PI * 2;
  const curvePhaseOffset = (hash01(curveIndex + 1, 41) - 0.5) * 0.34;
  return {
    phase: resolvedBundlePhase + curvePhaseOffset,
    bundlePhase: resolvedBundlePhase,
    flexibility: baseFlexibility + variability * flexibilityRange,
    depth,
  };
}

export function canUseStrandPointerInteraction({ mode = "desktop", motionEnabled = true, hints } = {}) {
  if (mode !== "desktop" || !motionEnabled) return false;
  const environment = hints || {
    finePointer: window.matchMedia("(pointer: fine)").matches,
    hover: window.matchMedia("(hover: hover)").matches,
  };
  return Boolean(environment.finePointer && environment.hover);
}

export function resolveStrandMotionCapability({ preference = "auto", hints } = {}) {
  if (preference === "static") return { enabled: false, reason: "Static preview requested" };
  if (!hints && typeof window === "undefined") return { enabled: false, reason: "Server render" };
  const environment = hints || {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean(navigator.connection?.saveData),
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: navigator.deviceMemory || 0,
  };
  const forcedPreview = preference === "force" || preference === "frame";
  if (!forcedPreview && environment.reducedMotion) {
    return { enabled: false, reason: "prefers-reduced-motion" };
  }
  if (!forcedPreview && environment.saveData) {
    return { enabled: false, reason: "Save-Data enabled" };
  }
  const weakProcessor = environment.hardwareConcurrency > 0 && environment.hardwareConcurrency <= 4;
  const weakMemory = environment.deviceMemory > 0 && environment.deviceMemory <= 4;
  if (!forcedPreview && (weakProcessor || weakMemory)) {
    return { enabled: false, reason: "Weak-device static tier" };
  }
  return { enabled: true, reason: "None" };
}

function geometryByteLength(geometry) {
  let bytes = geometry.index?.array?.byteLength || 0;
  for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array?.byteLength || 0;
  return bytes;
}

function interpolateCatmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function renderPointsForCurve(curve, subdivisions = 1) {
  const source = [];
  for (let index = 0; index < curve.points.length; index += 2) {
    source.push({ x: curve.points[index], y: curve.points[index + 1] });
  }
  if (subdivisions <= 1 || source.length < 3) return source;
  const rendered = [source[0]];
  for (let index = 0; index < source.length - 1; index += 1) {
    const p0 = source[Math.max(0, index - 1)];
    const p1 = source[index];
    const p2 = source[index + 1];
    const p3 = source[Math.min(source.length - 1, index + 2)];
    for (let step = 1; step <= subdivisions; step += 1) {
      if (step === subdivisions) rendered.push(p2);
      else rendered.push(interpolateCatmullRom(p0, p1, p2, p3, step / subdivisions));
    }
  }
  return rendered;
}

function cumulativeArcProfile(points) {
  const cumulative = new Float32Array(points.length);
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalLength += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    cumulative[index] = totalLength;
  }
  if (totalLength > 0) {
    for (let index = 1; index < cumulative.length; index += 1) cumulative[index] /= totalLength;
  }
  return { cumulative, totalLength };
}

function sampleArcProfile(points, cumulative, normalizedArc) {
  const target = clamp(normalizedArc, 0, 1);
  let upper = 1;
  while (upper < cumulative.length - 1 && cumulative[upper] < target) upper += 1;
  const lower = Math.max(0, upper - 1);
  const span = Math.max(0.000001, cumulative[upper] - cumulative[lower]);
  const mix = clamp((target - cumulative[lower]) / span, 0, 1);
  return {
    x: points[lower].x + (points[upper].x - points[lower].x) * mix,
    y: points[lower].y + (points[upper].y - points[lower].y) * mix,
  };
}

function crawlProfileForCurve(curve, curveIndex, curveCount, points = renderPointsForCurve(curve, 2)) {
  const { cumulative, totalLength } = cumulativeArcProfile(points);
  const forward = points[0].y <= points[points.length - 1].y;
  const centroidY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const spatialStep = Math.floor(clamp((centroidY - 0.15) / 0.72, 0, 1) * 14) / 14;
  const lengthWeight = clamp((totalLength - 0.018) / 0.145, 0, 1);
  const motion = curveMotionProfile(curve, curveIndex, curveBand(curve, curveIndex));
  const bundleVariation = Math.sin(motion.bundlePhase * 0.31) * 0.01;
  let activationOrder = 0.04 + spatialStep * 0.58;
  if (curve.kind === "toe") activationOrder = 0.66 + spatialStep * 0.14;
  if (curve.kind === "wake") activationOrder = 0.12 + spatialStep * 0.5 + lengthWeight * 0.26;
  activationOrder = clamp(activationOrder + bundleVariation, 0.02, 0.9);
  return {
    points,
    cumulative,
    totalLength,
    forward,
    direction: forward ? 1 : -1,
    lookupY: (curveIndex + 0.5) / curveCount,
    activationOrder,
    crawlArcAt(index) {
      const sourceArc = cumulative[clamp(index, 0, cumulative.length - 1)];
      return forward ? sourceArc : 1 - sourceArc;
    },
  };
}

function packCrawlArcAndOrder(crawlArc, activationOrder) {
  const orderCode = Math.round(clamp(activationOrder, 0, 1) * 1023);
  return clamp(crawlArc, 0, 1) + orderCode * 2;
}

export function buildStrandCrawlLookup(asset = strandAsset, sampleCount = STRAND_WAKEUP_PROFILE.lookupSamples) {
  validateApprovedAsset(asset);
  const profiles = asset.curves.map((curve, curveIndex) => (
    crawlProfileForCurve(curve, curveIndex, asset.curves.length)
  ));
  const data = new Float32Array(sampleCount * asset.curves.length * 4);
  profiles.forEach((profile, curveIndex) => {
    const orientedPoints = profile.forward ? profile.points : [...profile.points].reverse();
    const orientedArc = cumulativeArcProfile(orientedPoints).cumulative;
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const sample = sampleArcProfile(orientedPoints, orientedArc, sampleIndex / Math.max(1, sampleCount - 1));
      const offset = (curveIndex * sampleCount + sampleIndex) * 4;
      data[offset] = sample.x;
      data[offset + 1] = sample.y;
      data[offset + 2] = 0;
      data[offset + 3] = 1;
    }
  });
  return { data, profiles, width: sampleCount, height: asset.curves.length, byteLength: data.byteLength };
}

function createStrandCrawlTexture(lookup) {
  const texture = new THREE.DataTexture(lookup.data, lookup.width, lookup.height, THREE.RGBAFormat, THREE.FloatType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function buildGeometryFromApprovedAsset(asset, subdivisions) {
  validateApprovedAsset(asset);
  const positions = [];
  const previous = [];
  const next = [];
  const side = [];
  const width = [];
  const colour = [];
  const alpha = [];
  const kind = [];
  const seed = [];
  const phase = [];
  const bundlePhase = [];
  const flexibility = [];
  const depth = [];
  const arcPosition = [];
  const indices = [];
  const curveBands = [];
  const crawlProfiles = asset.curves.map((curve, curveIndex) => (
    crawlProfileForCurve(curve, curveIndex, asset.curves.length, renderPointsForCurve(curve, subdivisions))
  ));
  let segmentCount = 0;

  asset.curves.forEach((curve, curveIndex) => {
    const points = renderPointsForCurve(curve, subdivisions);
    if (points.length < 2) return;
    const firstVertex = positions.length / 3;
    const kindValue = curve.kind === "wake" ? 1 : curve.kind === "toe" ? 0.5 : 0;
    const bandValue = curveBand(curve, curveIndex);
    const seedValue = hash01(curveIndex + 1, 29);
    const motion = curveMotionProfile(curve, curveIndex, bandValue);
    const crawl = crawlProfiles[curveIndex];
    curveBands[curveIndex] = bandValue;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const before = points[Math.max(0, pointIndex - 1)];
      const after = points[Math.min(points.length - 1, pointIndex + 1)];
      const previousPoint = pointIndex === 0
        ? { x: point.x * 2 - after.x, y: point.y * 2 - after.y }
        : before;
      const nextPoint = pointIndex === points.length - 1
        ? { x: point.x * 2 - before.x, y: point.y * 2 - before.y }
        : after;
      for (const ribbonSide of [-1, 1]) {
        positions.push(point.x, point.y, 0);
        const crawlArc = crawl.crawlArcAt(pointIndex);
        previous.push(previousPoint.x, previousPoint.y, crawl.lookupY * crawl.direction);
        next.push(nextPoint.x, nextPoint.y, packCrawlArcAndOrder(crawlArc, crawl.activationOrder));
        side.push(ribbonSide);
        width.push(curve.width);
        colour.push(curve.colour);
        alpha.push(curve.alpha);
        kind.push(kindValue);
        seed.push(seedValue);
        phase.push(motion.phase);
        bundlePhase.push(motion.bundlePhase);
        flexibility.push(motion.flexibility);
        depth.push(motion.depth);
        arcPosition.push(pointIndex / Math.max(1, points.length - 1));
      }
    }
    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
      const base = firstVertex + pointIndex * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      segmentCount += 1;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPrevious", new THREE.Float32BufferAttribute(previous, 3));
  geometry.setAttribute("aNext", new THREE.Float32BufferAttribute(next, 3));
  geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  geometry.setAttribute("aWidth", new THREE.Float32BufferAttribute(width, 1));
  geometry.setAttribute("aColour", new THREE.Float32BufferAttribute(colour, 1));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alpha, 1));
  geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  geometry.setAttribute("aBundlePhase", new THREE.Float32BufferAttribute(bundlePhase, 1));
  geometry.setAttribute("aFlexibility", new THREE.Float32BufferAttribute(flexibility, 1));
  geometry.setAttribute("aDepth", new THREE.Float32BufferAttribute(depth, 1));
  geometry.setAttribute("aArcPosition", new THREE.Float32BufferAttribute(arcPosition, 1));
  geometry.setIndex(indices);
  return {
    geometry,
    curveBands,
    segmentCount,
    vertexCount: positions.length / 3,
    bufferBytes: geometryByteLength(geometry),
    renderSubdivisions: subdivisions,
    crawlProfiles,
  };
}

export function buildStrandProofGeometry(asset = strandAsset) {
  return buildGeometryFromApprovedAsset(asset, 1);
}

export function buildSmoothedStrandProofGeometry(asset = strandAsset) {
  return buildGeometryFromApprovedAsset(asset, 2);
}

function pointFromCurve(curve, pointIndex) {
  const index = clamp(pointIndex, 0, curve.points.length / 2 - 1) * 2;
  return { x: curve.points[index], y: curve.points[index + 1] };
}

function findIntersectionHighlights(asset, curveBands, tier) {
  const cellSize = 0.016;
  const grid = new Map();
  const candidates = [];
  asset.curves.forEach((curve, curveIndex) => {
    const pointCount = curve.points.length / 2;
    for (let pointIndex = 1; pointIndex < pointCount - 1; pointIndex += 2) {
      const point = pointFromCurve(curve, pointIndex);
      const before = pointFromCurve(curve, pointIndex - 1);
      const after = pointFromCurve(curve, pointIndex + 1);
      const tangentX = after.x - before.x;
      const tangentY = (after.y - before.y) * 1.5;
      const tangentLength = Math.hypot(tangentX, tangentY) || 1;
      const entry = {
        x: point.x,
        y: point.y,
        tangentX: tangentX / tangentLength,
        tangentY: tangentY / tangentLength,
        curveIndex,
        alpha: curve.alpha,
        colour: curve.colour,
        progress: pointIndex / Math.max(1, pointCount - 1),
      };
      const cellX = Math.floor(point.x / cellSize);
      const cellY = Math.floor(point.y / cellSize);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighbours = grid.get(`${cellX + offsetX}:${cellY + offsetY}`) || [];
          for (const other of neighbours) {
            if (other.curveIndex === curveIndex) continue;
            const dx = point.x - other.x;
            const dy = (point.y - other.y) * 1.5;
            const distance = Math.hypot(dx, dy);
            if (distance > 0.011) continue;
            const directionDifference = 1 - Math.abs(entry.tangentX * other.tangentX + entry.tangentY * other.tangentY);
            if (directionDifference < 0.08) continue;
            const brightness = curve.alpha + other.alpha + (curve.colour + other.colour) * 0.11;
            const driver = curve.alpha + curve.colour * 0.12 >= other.alpha + other.colour * 0.12 ? entry : other;
            candidates.push({
              x: (point.x + other.x) * 0.5,
              y: (point.y + other.y) * 0.5,
              band: Math.max(curveBands[curveIndex], curveBands[other.curveIndex]),
              score: brightness * (0.45 + directionDifference) * (1 - distance / 0.012),
              seed: hash01(curveIndex * 4099 + other.curveIndex, pointIndex + 37),
              curveIndex: driver.curveIndex,
              progress: driver.progress,
              tangentX: driver.tangentX,
              tangentY: driver.tangentY,
            });
          }
        }
      }
      const key = `${cellX}:${cellY}`;
      const cell = grid.get(key) || [];
      if (cell.length < 14) cell.push(entry);
      else {
        const weakestIndex = cell.reduce((minimum, current, index) => current.alpha < cell[minimum].alpha ? index : minimum, 0);
        if (entry.alpha > cell[weakestIndex].alpha) cell[weakestIndex] = entry;
      }
      grid.set(key, cell);
    }
  });
  candidates.sort((left, right) => right.score - left.score);
  const selected = [];
  for (const candidate of candidates) {
    const separated = selected.every((existing) => {
      const dx = candidate.x - existing.x;
      const dy = (candidate.y - existing.y) * 1.5;
      return Math.hypot(dx, dy) >= tier.highlightSpacing;
    });
    if (!separated) continue;
    selected.push(candidate);
    if (selected.length >= tier.highlights) break;
  }
  return selected;
}

function buildAtmosphereGeometry(asset, curveBands, tier) {
  const positions = [];
  const sizes = [];
  const intensities = [];
  const types = [];
  const phases = [];
  const bundlePhases = [];
  const flexibilities = [];
  const depths = [];
  const arcPositions = [];
  const motionTangents = [];
  const motionKinds = [];
  const attachments = [];
  const travelDistances = [];
  const crawlData = [];
  const crawlProfiles = asset.curves.map((curve, curveIndex) => (
    crawlProfileForCurve(curve, curveIndex, asset.curves.length, renderPointsForCurve(curve, 1))
  ));
  const appendMotionAttributes = (curve, curveIndex, pointIndex, tangentOverride) => {
    const pointCount = curve.points.length / 2;
    const before = pointFromCurve(curve, Math.max(0, pointIndex - 1));
    const after = pointFromCurve(curve, Math.min(pointCount - 1, pointIndex + 1));
    const motion = curveMotionProfile(curve, curveIndex, curveBands[curveIndex]);
    const tangentX = tangentOverride?.x ?? after.x - before.x;
    const tangentY = tangentOverride?.y ?? after.y - before.y;
    phases.push(motion.phase);
    bundlePhases.push(motion.bundlePhase);
    flexibilities.push(motion.flexibility);
    depths.push(motion.depth);
    arcPositions.push(pointIndex / Math.max(1, pointCount - 1));
    motionTangents.push(tangentX, tangentY);
    motionKinds.push(curve.kind === "wake" ? 1 : curve.kind === "toe" ? 0.5 : 0);
    const crawl = crawlProfiles[curveIndex];
    crawlData.push(crawl.lookupY, crawl.crawlArcAt(pointIndex), crawl.activationOrder, crawl.direction);
  };
  for (let index = 0; index < tier.particles; index += 1) {
    const curveIndex = Math.floor(hash01(index + 1, 71) * asset.curves.length);
    const curve = asset.curves[curveIndex];
    const pointCount = curve.points.length / 2;
    const pointIndex = Math.floor(hash01(index + 1, 73) * pointCount);
    const anchor = pointFromCurve(curve, pointIndex);
    const freeParticle = hash01(index + 1, 101) < tier.freeParticleRatio;
    const spread = freeParticle
      ? curve.kind === "wake" ? 0.07 : 0.048
      : curve.kind === "wake" ? 0.017 : 0.01;
    const angle = hash01(index + 1, 79) * Math.PI * 2;
    const radius = Math.pow(hash01(index + 1, 83), freeParticle ? 0.78 : 1.7) * spread;
    positions.push(anchor.x + Math.cos(angle) * radius, anchor.y + Math.sin(angle) * radius, 0);
    sizes.push((freeParticle ? 2.15 : 1.8) + hash01(index + 1, 89) * (curve.colour >= 2 ? 2.8 : 2.35));
    intensities.push(0.48 + hash01(index + 1, 97) * 0.4);
    types.push(freeParticle ? 0 : 0.5);
    attachments.push(freeParticle ? 0 : 1);
    travelDistances.push(tier.freeParticleTravel * (0.62 + hash01(index + 1, 103) * 0.38));
    appendMotionAttributes(curve, curveIndex, pointIndex);
  }
  const highlights = findIntersectionHighlights(asset, curveBands, tier);
  for (const highlight of highlights) {
    positions.push(highlight.x, highlight.y, 0);
    sizes.push(4.4 + highlight.seed * 4.0);
    intensities.push(clamp(0.44 + highlight.score * 0.18, 0.44, 0.78));
    types.push(1);
    attachments.push(1);
    travelDistances.push(0);
    const curve = asset.curves[highlight.curveIndex];
    const pointCount = curve.points.length / 2;
    const pointIndex = Math.round(highlight.progress * Math.max(1, pointCount - 1));
    appendMotionAttributes(curve, highlight.curveIndex, pointIndex, { x: highlight.tangentX, y: highlight.tangentY });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aIntensity", new THREE.Float32BufferAttribute(intensities, 1));
  geometry.setAttribute("aType", new THREE.Float32BufferAttribute(types, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aBundlePhase", new THREE.Float32BufferAttribute(bundlePhases, 1));
  geometry.setAttribute("aFlexibility", new THREE.Float32BufferAttribute(flexibilities, 1));
  geometry.setAttribute("aDepth", new THREE.Float32BufferAttribute(depths, 1));
  geometry.setAttribute("aArcPosition", new THREE.Float32BufferAttribute(arcPositions, 1));
  geometry.setAttribute("aMotionTangent", new THREE.Float32BufferAttribute(motionTangents, 2));
  geometry.setAttribute("aKind", new THREE.Float32BufferAttribute(motionKinds, 1));
  geometry.setAttribute("aAttachment", new THREE.Float32BufferAttribute(attachments, 1));
  geometry.setAttribute("aTravelDistance", new THREE.Float32BufferAttribute(travelDistances, 1));
  geometry.setAttribute("aCrawlData", new THREE.Float32BufferAttribute(crawlData, 4));
  const freeParticleCount = attachments.reduce((sum, value, index) => sum + (index < tier.particles && value < 0.5 ? 1 : 0), 0);
  return {
    geometry,
    particleCount: tier.particles,
    freeParticleCount,
    attachedParticleCount: tier.particles - freeParticleCount,
    highlightCount: highlights.length,
    bufferBytes: geometryByteLength(geometry),
  };
}

function makeRibbonMaterial({ tier, focusSpec, presentation, viewport, glow, motionEnabled, wakeupProgress, crawlTexture }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uViewport: { value: viewport },
      uPixelRatio: { value: 1 },
      uFocusCenter: { value: new THREE.Vector2(...focusSpec.center) },
      uFocusScale: { value: focusSpec.scale },
      uWidthScale: { value: tier.widthScale },
      uMinPixelWidth: { value: tier.minPixelWidth },
      uPassWidth: { value: glow ? tier.glowWidth : 1 },
      uDepthStrength: { value: tier.depthStrength },
      uGlowPass: { value: glow ? 1 : 0 },
      uPassAlpha: { value: glow ? tier.glowAlpha : tier.baseAlpha },
      uRibbonLuminance: { value: tier.ribbonLuminance },
      uHaloLuminance: { value: tier.haloLuminance },
      uTime: { value: 0 },
      uMotionEnabled: { value: motionEnabled ? 1 : 0 },
      uMotionAmplitude: { value: tier.motionAmplitude },
      uMotionSpeed: { value: tier.motionSpeed },
      uMotionCoherence: { value: tier.motionCoherence },
      uPresentationScale: { value: presentation.scale },
      uPresentationRotation: { value: THREE.MathUtils.degToRad(presentation.rotationDegrees) },
      uPresentationTranslation: { value: new THREE.Vector2(...(presentation.translation || [0, 0])) },
      uWakeupProgress: { value: wakeupProgress },
      uCrawlCurveTexture: { value: crawlTexture },
      uCrawlSampleCount: { value: STRAND_WAKEUP_PROFILE.lookupSamples },
      uPointerPosition: { value: new THREE.Vector2(-10, -10) },
      uPointerTrailPosition: { value: new THREE.Vector2(-10, -10) },
      uPointerVelocity: { value: new THREE.Vector2() },
      uPointerStrength: { value: 0 },
      uPointerTrailStrength: { value: 0 },
      uPointerRadius: { value: tier.pointerRadius },
      uPointerAmplitude: { value: tier.pointerAmplitude },
    },
    vertexShader: strandProofVertexShader,
    fragmentShader: strandProofFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: false,
    toneMapped: false,
  });
}

function makePointMaterial({ tier, focusSpec, presentation, viewport, motionEnabled, wakeupProgress, crawlTexture }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uViewport: { value: viewport },
      uPixelRatio: { value: 1 },
      uFocusCenter: { value: new THREE.Vector2(...focusSpec.center) },
      uFocusScale: { value: focusSpec.scale },
      uDepthStrength: { value: tier.depthStrength },
      uPointLuminance: { value: tier.pointLuminance },
      uTime: { value: 0 },
      uMotionEnabled: { value: motionEnabled ? 1 : 0 },
      uMotionAmplitude: { value: tier.motionAmplitude },
      uMotionSpeed: { value: tier.motionSpeed },
      uMotionCoherence: { value: tier.motionCoherence },
      uPresentationScale: { value: presentation.scale },
      uPresentationRotation: { value: THREE.MathUtils.degToRad(presentation.rotationDegrees) },
      uPresentationTranslation: { value: new THREE.Vector2(...(presentation.translation || [0, 0])) },
      uWakeupProgress: { value: wakeupProgress },
      uCrawlCurveTexture: { value: crawlTexture },
      uCrawlSampleCount: { value: STRAND_WAKEUP_PROFILE.lookupSamples },
      uPointerPosition: { value: new THREE.Vector2(-10, -10) },
      uPointerTrailPosition: { value: new THREE.Vector2(-10, -10) },
      uPointerVelocity: { value: new THREE.Vector2() },
      uPointerStrength: { value: 0 },
      uPointerTrailStrength: { value: 0 },
      uPointerRadius: { value: tier.pointerRadius },
      uPointerAmplitude: { value: tier.pointerAmplitude },
    },
    vertexShader: strandProofPointVertexShader,
    fragmentShader: strandProofPointFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: false,
    toneMapped: false,
  });
}

export function strandProofFallbackMetrics(reason) {
  return {
    state: "fallback",
    fallbackReason: reason,
    curveCount: APPROVED_CURVE_COUNT,
    pointCount: APPROVED_POINT_COUNT,
    segmentCount: strandAsset.counts.segments,
    vertexCount: 0,
    drawCalls: 0,
    textures: 0,
    geometries: 0,
    dpr: 0,
    drawingBuffer: { width: 0, height: 0 },
    setupTimeMs: 0,
    renderTimeMs: 0,
    fps: 0,
    benchmarkRenderP95Ms: 0,
    benchmarkFrameIntervalP95Ms: 0,
    benchmarkFrames: 0,
    animationFrames: 0,
    motionEnabled: false,
    targetFps: 0,
    particleCount: 0,
    freeParticleCount: 0,
    attachedParticleCount: 0,
    highlightCount: 0,
    depthBands: 3,
    memory: { geometryBytes: 0, framebufferBytes: 0, estimatedGpuBytes: 0, jsHeapUsedBytes: 0 },
  };
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

export async function createStrandProofRenderer({
  canvas,
  root,
  mode = "desktop",
  focus = "full",
  motionPreference = "auto",
  onMetrics,
}) {
  const setupStartedAt = performance.now();
  validateApprovedAsset(strandAsset);
  const tier = RENDER_TIERS[mode] || RENDER_TIERS.desktop;
  const motionCapability = resolveStrandMotionCapability({ preference: motionPreference });
  const captureFrame = motionPreference === "frame";
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    premultipliedAlpha: false,
    antialias: tier.antialias,
    powerPreference: tier.powerPreference,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const built = buildSmoothedStrandProofGeometry();
  const crawlLookup = buildStrandCrawlLookup();
  const crawlTexture = createStrandCrawlTexture(crawlLookup);
  const atmosphere = buildAtmosphereGeometry(strandAsset, built.curveBands, tier);
  const viewport = new THREE.Vector2(1, 1);
  const focusSpec = REVIEW_FOCUS[focus] || strandAsset.focus[focus] || strandAsset.focus.full;
  const presentation = resolveStrandPresentation({ mode, focus });
  const presentationTranslation = presentation.translation || [0, 0];
  const wakeupEnabled = resolveStrandWakeupEnabled({
    mode,
    focus,
    motionEnabled: motionCapability.enabled,
    captureFrame,
  });
  let currentWakeupProgress = strandWakeupProgress(0, wakeupEnabled);
  const glowMaterial = makeRibbonMaterial({ tier, focusSpec, presentation, viewport, glow: true, motionEnabled: motionCapability.enabled, wakeupProgress: currentWakeupProgress, crawlTexture });
  const baseMaterial = makeRibbonMaterial({ tier, focusSpec, presentation, viewport, glow: false, motionEnabled: motionCapability.enabled, wakeupProgress: currentWakeupProgress, crawlTexture });
  const pointMaterial = makePointMaterial({ tier, focusSpec, presentation, viewport, motionEnabled: motionCapability.enabled, wakeupProgress: currentWakeupProgress, crawlTexture });
  const glowMesh = new THREE.Mesh(built.geometry, glowMaterial);
  const baseMesh = new THREE.Mesh(built.geometry, baseMaterial);
  const atmospherePoints = new THREE.Points(atmosphere.geometry, pointMaterial);
  glowMesh.frustumCulled = false;
  baseMesh.frustumCulled = false;
  atmospherePoints.frustumCulled = false;
  glowMesh.renderOrder = 0;
  baseMesh.renderOrder = 1;
  atmospherePoints.renderOrder = 2;
  scene.add(glowMesh, baseMesh, atmospherePoints);
  const setupTimeMs = performance.now() - setupStartedAt;

  let disposed = false;
  let actualDpr = 1;
  let renderTimeMs = 0;
  let drawingBuffer = new THREE.Vector2();
  let benchmarkFrame = 0;
  let benchmarkResolve = null;
  let animationFrame = 0;
  let animationFrames = 0;
  let activeTime = captureFrame ? 6.5 : 0;
  let lastTick = 0;
  let lastRenderedAt = 0;
  let lastMetricsAt = 0;
  let lastPointerMetricsAt = 0;
  let benchmarking = false;
  let documentVisible = !document.hidden;
  let intersecting = true;
  let intersectionObserver;
  let lastBenchmark = {
    fps: 0,
    frames: 0,
    averageRenderTimeMs: 0,
    renderP95Ms: 0,
    frameIntervalP95Ms: 0,
  };
  let metrics = strandProofFallbackMetrics("Initialising");
  const geometryBytes = built.bufferBytes + atmosphere.bufferBytes + crawlLookup.byteLength;
  const pointerInteractionEnabled = canUseStrandPointerInteraction({
    mode,
    motionEnabled: motionCapability.enabled && !captureFrame,
  });
  const pointerState = {
    inside: false,
    position: new THREE.Vector2(-10, -10),
    trailPosition: new THREE.Vector2(-10, -10),
    targetPosition: new THREE.Vector2(-10, -10),
    velocity: new THREE.Vector2(),
    rawVelocity: new THREE.Vector2(),
    previousPosition: new THREE.Vector2(),
    strength: 0,
    strengthVelocity: 0,
    targetStrength: 0,
    sampleStrength: 0,
    lastMoveAt: 0,
  };

  function memoryMetrics() {
    renderer.getDrawingBufferSize(drawingBuffer);
    const framebufferBytes = drawingBuffer.x * drawingBuffer.y * 4 * (tier.antialias ? 2 : 1);
    return {
      geometryBytes,
      framebufferBytes,
      estimatedGpuBytes: geometryBytes + framebufferBytes,
      jsHeapUsedBytes: performance.memory?.usedJSHeapSize || 0,
    };
  }

  const motionMaterials = [glowMaterial, baseMaterial, pointMaterial];

  function setPointerUniforms() {
    for (const material of motionMaterials) {
      material.uniforms.uPointerPosition.value.copy(pointerState.position);
      material.uniforms.uPointerTrailPosition.value.copy(pointerState.trailPosition);
      material.uniforms.uPointerVelocity.value.copy(pointerState.velocity);
      material.uniforms.uPointerStrength.value = pointerState.strength;
      material.uniforms.uPointerTrailStrength.value = pointerState.strength;
    }
  }

  function imagePointFromClient(clientX, clientY) {
    const rect = root.getBoundingClientRect();
    if (
      rect.width <= 0
      || rect.height <= 0
      || clientX < rect.left
      || clientX > rect.right
      || clientY < rect.top
      || clientY > rect.bottom
    ) return null;
    const presentedX = ((clientX - rect.left) / rect.width) * 2 - 1 - presentationTranslation[0];
    const presentedY = 1 - ((clientY - rect.top) / rect.height) * 2 - presentationTranslation[1];
    const inverseRotation = THREE.MathUtils.degToRad(-presentation.rotationDegrees);
    const rotationCosine = Math.cos(inverseRotation);
    const rotationSine = Math.sin(inverseRotation);
    const ndcX = (presentedX * rotationCosine - presentedY * rotationSine) / presentation.scale;
    const ndcY = (presentedX * rotationSine + presentedY * rotationCosine) / presentation.scale;
    const viewportRatio = rect.width / Math.max(1, rect.height);
    const imageRatio = 2 / 3;
    const fitX = viewportRatio > imageRatio ? imageRatio / viewportRatio : 1;
    const fitY = viewportRatio > imageRatio ? 1 : viewportRatio / imageRatio;
    return new THREE.Vector2(
      ((ndcX / fitX + 1) * 0.5 - 0.5) / focusSpec.scale + focusSpec.center[0],
      ((ndcY / fitY + 1) * 0.5 - 0.5) / focusSpec.scale + focusSpec.center[1],
    );
  }

  function pointerMove(clientX, clientY) {
    if (!pointerInteractionEnabled || !isStrandWakeupSettled(currentWakeupProgress) || disposed) return false;
    const mapped = imagePointFromClient(clientX, clientY);
    if (!mapped) {
      pointerLeave();
      return false;
    }
    const now = performance.now();
    if (!pointerState.inside) {
      pointerState.position.copy(mapped);
      pointerState.trailPosition.copy(mapped);
      pointerState.targetPosition.copy(mapped);
      pointerState.previousPosition.copy(mapped);
      pointerState.velocity.set(0, 0);
      pointerState.rawVelocity.set(0, 0);
      pointerState.sampleStrength = 0;
    } else {
      const deltaSeconds = clamp((now - pointerState.lastMoveAt) / 1000, 1 / 120, 0.08);
      pointerState.rawVelocity.copy(mapped).sub(pointerState.previousPosition).multiplyScalar(1 / deltaSeconds);
      const velocityLength = pointerState.rawVelocity.length();
      if (velocityLength > STRAND_POINTER_REPULSION_PROFILE.maxVelocity) {
        pointerState.rawVelocity.multiplyScalar(STRAND_POINTER_REPULSION_PROFILE.maxVelocity / velocityLength);
      }
      pointerState.sampleStrength = clamp(
        (velocityLength - 0.01) / STRAND_POINTER_REPULSION_PROFILE.fullStrengthVelocity,
        0,
        1,
      );
      pointerState.previousPosition.copy(mapped);
      pointerState.targetPosition.copy(mapped);
    }
    pointerState.inside = true;
    pointerState.lastMoveAt = now;
    return true;
  }

  function pointerLeave() {
    pointerState.inside = false;
    pointerState.sampleStrength = 0;
    pointerState.targetStrength = Math.min(pointerState.targetStrength, pointerState.strength);
    pointerState.strengthVelocity = Math.min(pointerState.strengthVelocity, 0);
  }

  function updatePointer(deltaSeconds) {
    if (!pointerInteractionEnabled || deltaSeconds <= 0) return;
    const now = performance.now();
    const pressureFresh = pointerState.inside
      && now - pointerState.lastMoveAt <= STRAND_POINTER_REPULSION_PROFILE.releaseDelayMs;
    const desiredStrength = pressureFresh ? pointerState.sampleStrength : 0;
    const targetRate = desiredStrength > pointerState.targetStrength
      ? STRAND_POINTER_REPULSION_PROFILE.targetAttackRate
      : STRAND_POINTER_REPULSION_PROFILE.targetReleaseRate;
    const targetMix = 1 - Math.exp(-deltaSeconds * targetRate);
    pointerState.targetStrength += (desiredStrength - pointerState.targetStrength) * targetMix;
    if (
      desiredStrength < pointerState.strength
      && pointerState.targetStrength <= pointerState.strength
      && pointerState.strengthVelocity > 0
    ) pointerState.strengthVelocity = 0;
    const positionMix = 1 - Math.exp(-deltaSeconds * STRAND_POINTER_REPULSION_PROFILE.positionFollowRate);
    const trailMix = 1 - Math.exp(-deltaSeconds * STRAND_POINTER_REPULSION_PROFILE.trailFollowRate);
    const velocityMix = 1 - Math.exp(-deltaSeconds * STRAND_POINTER_REPULSION_PROFILE.velocityFollowRate);
    pointerState.position.lerp(pointerState.targetPosition, positionMix);
    pointerState.trailPosition.lerp(pointerState.position, trailMix);
    if (pressureFresh) pointerState.velocity.lerp(pointerState.rawVelocity, velocityMix);
    else pointerState.velocity.multiplyScalar(Math.exp(-deltaSeconds * 3.4));
    const recoveryOmega = pointerState.targetStrength > pointerState.strength
      ? STRAND_POINTER_REPULSION_PROFILE.riseOmega
      : STRAND_POINTER_REPULSION_PROFILE.recoveryOmega;
    const acceleration = recoveryOmega * recoveryOmega * (pointerState.targetStrength - pointerState.strength)
      - 2 * recoveryOmega * pointerState.strengthVelocity;
    pointerState.strengthVelocity += acceleration * deltaSeconds;
    pointerState.strength = clamp(pointerState.strength + pointerState.strengthVelocity * deltaSeconds, 0, 1);
    if (pointerState.strength < 0.0005 && pointerState.targetStrength < 0.0005 && desiredStrength === 0) {
      pointerState.strength = 0;
      pointerState.strengthVelocity = 0;
      pointerState.targetStrength = 0;
      pointerState.velocity.set(0, 0);
    }
    setPointerUniforms();
  }

  function lifecycleState() {
    if (!motionCapability.enabled) return "static";
    if (captureFrame) return "motion-frame";
    if (!documentVisible) return "hidden";
    if (!intersecting) return "suspended";
    if (benchmarking) return "benchmark";
    return "active";
  }

  function emitMetrics(state = lifecycleState()) {
    renderer.getDrawingBufferSize(drawingBuffer);
    metrics = {
      state,
      fallbackReason: motionCapability.reason,
      curveCount: strandAsset.counts.curves,
      pointCount: strandAsset.counts.points,
      segmentCount: built.segmentCount,
      vertexCount: built.vertexCount,
      drawCalls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      dpr: actualDpr,
      drawingBuffer: { width: drawingBuffer.x, height: drawingBuffer.y },
      setupTimeMs,
      renderTimeMs,
      fps: lastBenchmark.fps,
      benchmarkFrames: lastBenchmark.frames,
      benchmarkRenderTimeMs: lastBenchmark.averageRenderTimeMs,
      benchmarkRenderP95Ms: lastBenchmark.renderP95Ms,
      benchmarkFrameIntervalP95Ms: lastBenchmark.frameIntervalP95Ms,
      animationFrames,
      motionEnabled: motionCapability.enabled,
      motionPreference,
      targetFps: tier.targetFps,
      particleCount: atmosphere.particleCount,
      freeParticleCount: atmosphere.freeParticleCount,
      attachedParticleCount: atmosphere.attachedParticleCount,
      highlightCount: atmosphere.highlightCount,
      depthBands: 3,
      mode,
      focus,
      tier: mode,
      presentation: {
        scale: presentation.scale,
        rotationDegrees: presentation.rotationDegrees,
        translation: [...presentationTranslation],
      },
      curveDataSha256: APPROVED_CURVE_DATA_SHA256,
      renderSmoothing: {
        interpolation: "Catmull-Rom midpoint",
        subdivisions: built.renderSubdivisions,
        canonicalSegments: strandAsset.counts.segments,
        renderedSegments: built.segmentCount,
        minPixelWidth: tier.minPixelWidth,
      },
      motion: {
        direction: [-0.985, 0.172],
        amplitude: tier.motionAmplitude,
        speed: tier.motionSpeed,
        coherence: tier.motionCoherence,
        cadenceFps: tier.targetFps,
        rearAmplitude: 1.08,
        middleAmplitude: 0.96,
        frontAmplitude: 0.84,
        rearSpeed: 0.9,
        middleSpeed: 0.99,
        frontSpeed: 1.08,
        wakeAmplitude: 2.04,
        wakeSpeed: 1.08,
        toeAmplitude: 0.48,
        gustSpatialVectors: tier.motionCoherence ? [[6.2, 0.72], [2.55, 0.34]] : [[8.4, 0], [3.15, 0]],
        gustTravelSpeeds: tier.motionCoherence ? [1.18, 0.46] : [1.46, 0.54],
        arcPhaseContribution: tier.motionCoherence ? 0.12 : 0.34,
        crosswindLift: tier.motionCoherence ? 0.045 : 0.075,
        flexibilityVariationRetained: tier.motionCoherence ? 0.22 : 1,
        particleTravelDistance: tier.freeParticleTravel,
        freeParticleRatio: tier.freeParticleRatio,
        pointerEnabled: pointerInteractionEnabled,
        pointerMode: STRAND_POINTER_REPULSION_PROFILE.mode,
        pointerRadius: tier.pointerRadius,
        pointerAmplitude: tier.pointerAmplitude,
        pointerRecoverySeconds: STRAND_POINTER_REPULSION_PROFILE.recoverySeconds,
        pointerTrailFollowRate: STRAND_POINTER_REPULSION_PROFILE.trailFollowRate,
        pointerTrailWeight: STRAND_POINTER_REPULSION_PROFILE.trailWeight,
        pointerReleaseDelayMs: STRAND_POINTER_REPULSION_PROFILE.releaseDelayMs,
        pointerMaxVelocity: STRAND_POINTER_REPULSION_PROFILE.maxVelocity,
        pointerTargetStrength: Number(pointerState.targetStrength.toFixed(4)),
        pointerSampleStrength: Number(pointerState.sampleStrength.toFixed(4)),
        pointerOutwardOnly: true,
        pointerLongitudinalRadius: STRAND_POINTER_REPULSION_PROFILE.longitudinalRadius,
        pointerLateralRadius: STRAND_POINTER_REPULSION_PROFILE.lateralRadius,
        pointerCoreClamp: STRAND_POINTER_REPULSION_PROFILE.coreClamp,
        pointerWakeClamp: STRAND_POINTER_REPULSION_PROFILE.wakeClamp,
        pointerToeClampMultiplier: STRAND_POINTER_REPULSION_PROFILE.toeClampMultiplier,
        pointerTangentialPressureRetained: 0.38,
        pointerStrength: Number(pointerState.strength.toFixed(4)),
      },
      wakeup: {
        enabled: wakeupEnabled,
        mode: STRAND_WAKEUP_PROFILE.mode,
        durationSeconds: STRAND_WAKEUP_PROFILE.durationSeconds,
        progress: Number(currentWakeupProgress.toFixed(4)),
        phase: strandWakeupPhase(currentWakeupProgress),
        cursorReady: pointerInteractionEnabled && isStrandWakeupSettled(currentWakeupProgress),
        lookupSamples: STRAND_WAKEUP_PROFILE.lookupSamples,
        lookupCurves: crawlLookup.height,
        lookupBytes: crawlLookup.byteLength,
        transitionWidth: STRAND_WAKEUP_PROFILE.transitionWidth,
        compactedLengthRatio: STRAND_WAKEUP_PROFILE.compactedLengthRatio,
        terminalOffset: currentWakeupProgress >= 1 ? 0 : null,
      },
      memory: memoryMetrics(),
    };
    onMetrics?.(metrics);
    return metrics;
  }

  function setMotionTime(value) {
    currentWakeupProgress = strandWakeupProgress(value, wakeupEnabled);
    for (const material of motionMaterials) {
      material.uniforms.uTime.value = value;
      material.uniforms.uWakeupProgress.value = currentWakeupProgress;
    }
  }

  function renderFrame(time = activeTime) {
    setMotionTime(time);
    renderer.info.reset();
    const renderStartedAt = performance.now();
    renderer.render(scene, camera);
    return Math.max(0.01, performance.now() - renderStartedAt);
  }

  function renderOnce() {
    if (disposed) return;
    renderTimeMs = renderFrame();
    emitMetrics();
  }

  function advanceMotion(timestamp) {
    if (!lastTick) {
      lastTick = timestamp;
      return 0;
    }
    const deltaSeconds = Math.min(0.05, Math.max(0, timestamp - lastTick) / 1000);
    activeTime += deltaSeconds;
    lastTick = timestamp;
    updatePointer(deltaSeconds);
    return deltaSeconds;
  }

  function stopAnimationFrame() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastTick = 0;
  }

  function scheduleAnimation() {
    if (
      disposed
      || animationFrame
      || benchmarking
      || captureFrame
      || !motionCapability.enabled
      || !documentVisible
      || !intersecting
    ) return;
    animationFrame = requestAnimationFrame(animationStep);
  }

  function animationStep(timestamp) {
    animationFrame = 0;
    if (disposed || benchmarking || !documentVisible || !intersecting || !motionCapability.enabled) return;
    scheduleAnimation();
    const minimumInterval = 1000 / tier.targetFps;
    if (lastRenderedAt && timestamp - lastRenderedAt < minimumInterval - 0.75) return;
    advanceMotion(timestamp);
    lastRenderedAt = timestamp;
    renderTimeMs = renderFrame();
    animationFrames += 1;
    if (timestamp - lastMetricsAt >= 1000) {
      lastMetricsAt = timestamp;
      emitMetrics();
    } else if (pointerState.strength > 0.002 && timestamp - lastPointerMetricsAt >= 100) {
      lastPointerMetricsAt = timestamp;
      emitMetrics();
    }
  }

  function resize() {
    if (disposed) return;
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    actualDpr = clamp(Math.min(window.devicePixelRatio || 1, tier.dprMax), 1, tier.dprMax);
    renderer.setPixelRatio(actualDpr);
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(viewport);
    for (const material of [glowMaterial, baseMaterial, pointMaterial]) material.uniforms.uPixelRatio.value = actualDpr;
    renderOnce();
    scheduleAnimation();
  }

  function benchmark(frameCount = 90) {
    if (disposed) return Promise.resolve({ ...metrics, state: "disposed" });
    if (benchmarkResolve) return Promise.resolve({ ...metrics, state: "benchmark-busy" });
    const frames = clamp(Math.round(frameCount), 30, 180);
    return new Promise((resolve) => {
      benchmarkResolve = resolve;
      benchmarking = true;
      stopAnimationFrame();
      let completed = 0;
      let renderTotal = 0;
      let firstRenderedAt = 0;
      let previousRenderedAt = 0;
      let lastBenchmarkRenderAt = 0;
      const renderSamples = [];
      const intervalSamples = [];
      const step = (timestamp) => {
        if (disposed) {
          benchmarkFrame = 0;
          const finish = benchmarkResolve;
          benchmarkResolve = null;
          finish?.({ ...metrics, state: "disposed" });
          return;
        }
        if (!documentVisible || !intersecting) {
          benchmarkFrame = requestAnimationFrame(step);
          return;
        }
        const minimumInterval = 1000 / tier.targetFps;
        if (lastBenchmarkRenderAt && timestamp - lastBenchmarkRenderAt < minimumInterval - 0.75) {
          benchmarkFrame = requestAnimationFrame(step);
          return;
        }
        advanceMotion(timestamp);
        if (!firstRenderedAt) firstRenderedAt = timestamp;
        if (previousRenderedAt) intervalSamples.push(timestamp - previousRenderedAt);
        previousRenderedAt = timestamp;
        lastBenchmarkRenderAt = timestamp;
        const sample = renderFrame();
        renderSamples.push(sample);
        renderTotal += sample;
        completed += 1;
        animationFrames += 1;
        if (completed < frames) {
          benchmarkFrame = requestAnimationFrame(step);
          return;
        }
        benchmarkFrame = 0;
        const elapsed = Math.max(1, previousRenderedAt - firstRenderedAt);
        lastBenchmark = {
          fps: Number((((frames - 1) * 1000) / elapsed).toFixed(2)),
          frames,
          averageRenderTimeMs: Number((renderTotal / frames).toFixed(3)),
          renderP95Ms: Number(percentile(renderSamples, 0.95).toFixed(3)),
          frameIntervalP95Ms: Number(percentile(intervalSamples, 0.95).toFixed(3)),
        };
        renderTimeMs = lastBenchmark.averageRenderTimeMs;
        benchmarking = false;
        const result = emitMetrics();
        const finish = benchmarkResolve;
        benchmarkResolve = null;
        finish?.(result);
        lastRenderedAt = previousRenderedAt;
        scheduleAnimation();
      };
      benchmarkFrame = requestAnimationFrame(step);
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (benchmarkFrame) cancelAnimationFrame(benchmarkFrame);
    stopAnimationFrame();
    benchmarkFrame = 0;
    const finish = benchmarkResolve;
    benchmarkResolve = null;
    finish?.({ ...metrics, state: "disposed" });
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    intersectionObserver?.disconnect();
    scene.remove(glowMesh, baseMesh, atmospherePoints);
    built.geometry.dispose();
    atmosphere.geometry.dispose();
    crawlTexture.dispose();
    glowMaterial.dispose();
    baseMaterial.dispose();
    pointMaterial.dispose();
    renderer.renderLists.dispose();
    renderer.dispose();
  }

  function handleVisibilityChange() {
    documentVisible = !document.hidden;
    if (!documentVisible) stopAnimationFrame();
    else scheduleAnimation();
    if (!documentVisible) pointerLeave();
    emitMetrics();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (typeof IntersectionObserver !== "undefined") {
    intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = Boolean(entry?.isIntersecting);
      if (!intersecting) stopAnimationFrame();
      else scheduleAnimation();
      if (!intersecting) pointerLeave();
      emitMetrics();
    }, { threshold: 0.01 });
    intersectionObserver.observe(root);
  }

  resize();
  scheduleAnimation();
  return {
    resize,
    dispose,
    benchmark,
    pointerMove,
    pointerLeave,
    pointerInteractionEnabled,
    getDiagnostics: () => ({
      ...metrics,
      memory: { ...metrics.memory },
      motion: { ...metrics.motion },
      wakeup: {
        ...metrics.wakeup,
        progress: Number(currentWakeupProgress.toFixed(4)),
        phase: strandWakeupPhase(currentWakeupProgress),
        cursorReady: pointerInteractionEnabled && isStrandWakeupSettled(currentWakeupProgress),
      },
    }),
  };
}
