#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng, flattenClosedPath, sha256 } from "../webfoot-geometry/geometry-lock-core.mjs";

const WIDTH = 512;
const HEIGHT = 768;
const SVG_VIEWBOX = Object.freeze({ width: 624, height: 704, centerX: 312, centerY: 352 });
const COMPONENT_IDS = Object.freeze(["sole", "toe-1", "toe-2", "toe-3", "toe-4", "toe-5"]);
const TARGET_COUNTS = Object.freeze({ sole: 650, "toe-1": 90, "toe-2": 80, "toe-3": 72, "toe-4": 64, "toe-5": 54, wake: 500 });
const PNG_COMPARISON_CURVE_TARGET = 1250;
const APPROVED_PNG_CURVE_COUNT = 1250;
const APPROVED_PNG_POINT_COUNT = 26158;
const APPROVED_PNG_TRACE_SHA256 = "0c34347c699ff68dfce88ea53c342f99b7f5b3ad74874c85785876295a2576e3";
const APPROVED_PNG_CURVE_DATA_SHA256 = "052daf8b75d244b366b2ce407c9e65f297fad27ea35d8e47449a02c54bd5cfcd";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, "../..");
const workspaceRoot = path.resolve(frontendRoot, "..");
const sourceDirectory = path.join(scriptDirectory, "source");
const guidePath = path.join(sourceDirectory, "option-2-guide.png");
const svgPath = path.join(sourceDirectory, "locked-anatomy.svg");
const outputDirectory = path.join(frontendRoot, "src/pages/dev/strand-proof/generated");
const reportDirectory = path.join(workspaceRoot, "test_reports/strand-geometry-proof/offline");
const pngComparisonDirectory = path.join(workspaceRoot, "test_reports/strand-geometry-proof/png-authoritative");
const geometryPath = path.join(outputDirectory, "strand-geometry.json");
const verifyOnly = process.argv.includes("--verify");
const pngComparisonOnly = process.argv.includes("--png-authoritative-comparison") || process.argv.includes("--comparison-only");
const freezeApprovedRuntime = process.argv.includes("--freeze-approved-runtime");

if (freezeApprovedRuntime && !pngComparisonOnly) throw new Error("--freeze-approved-runtime requires --png-authoritative-comparison.");

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const fract = (value) => value - Math.floor(value);
const hash = (x, y, salt = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123);
const vectorLength = (x, y) => Math.sqrt(x * x + y * y);

function decodeRgb(inputPath) {
  const argumentsList = [
    "-v", "error", "-i", inputPath,
    "-vf", `scale=${WIDTH}:${HEIGHT}:flags=lanczos`,
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ];
  for (const executable of [process.env.FFMPEG_PATH, "ffmpeg", "C:\\ffmpeg\\bin\\ffmpeg.exe"].filter(Boolean)) {
    const result = spawnSync(executable, argumentsList, { maxBuffer: WIDTH * HEIGHT * 4 });
    if (result.error && executable !== "C:\\ffmpeg\\bin\\ffmpeg.exe") continue;
    if (result.status !== 0) throw new Error(result.stderr?.toString("utf8") || result.error?.message || "FFmpeg failed to decode the guide PNG.");
    if (result.stdout.length !== WIDTH * HEIGHT * 3) throw new Error("Decoded guide dimensions are invalid.");
    return result.stdout;
  }
  throw new Error("FFmpeg is required to decode the offline guide PNG.");
}

function parseLockedSvg(svgText) {
  const rootTag = svgText.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const viewBox = rootTag.match(/viewBox="([^"]+)"/)?.[1]?.trim();
  if (viewBox !== "0 0 624 704") throw new Error(`Locked anatomy viewBox changed: ${viewBox || "missing"}.`);
  const tags = svgText.match(/<path\b[^>]*>/g) ?? [];
  if (tags.length !== COMPONENT_IDS.length) throw new Error(`Locked anatomy requires six paths; found ${tags.length}.`);
  const components = tags.map((tag, index) => {
    const pathData = tag.match(/\bd="([^"]+)"/)?.[1];
    if (!pathData) throw new Error(`Locked anatomy path ${index + 1} has no path data.`);
    const flattened = flattenClosedPath(pathData, 18);
    if (!flattened.closed) throw new Error(`Locked anatomy path ${index + 1} is not closed.`);
    return { id: COMPONENT_IDS[index], pathData, points: flattened.points };
  });
  return { components };
}

function blurFloat(input, width, height, passes = 1) {
  let current = Float32Array.from(input);
  const kernel = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  for (let pass = 0; pass < passes; pass += 1) {
    const horizontal = new Float32Array(current.length);
    const output = new Float32Array(current.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = 0;
        for (let offset = -2; offset <= 2; offset += 1) value += current[y * width + clamp(x + offset, 0, width - 1)] * kernel[offset + 2];
        horizontal[y * width + x] = value;
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = 0;
        for (let offset = -2; offset <= 2; offset += 1) value += horizontal[clamp(y + offset, 0, height - 1) * width + x] * kernel[offset + 2];
        output[y * width + x] = value;
      }
    }
    current = output;
  }
  return current;
}

function bilinear(field, x, y) {
  const left = clamp(Math.floor(x), 0, WIDTH - 1);
  const top = clamp(Math.floor(y), 0, HEIGHT - 1);
  const right = Math.min(WIDTH - 1, left + 1);
  const bottom = Math.min(HEIGHT - 1, top + 1);
  const tx = clamp(x - left, 0, 1);
  const ty = clamp(y - top, 0, 1);
  const upper = field[top * WIDTH + left] * (1 - tx) + field[top * WIDTH + right] * tx;
  const lower = field[bottom * WIDTH + left] * (1 - tx) + field[bottom * WIDTH + right] * tx;
  return upper * (1 - ty) + lower * ty;
}

function makeImageFields(rgb) {
  const intensity = new Float32Array(WIDTH * HEIGHT);
  for (let index = 0; index < intensity.length; index += 1) {
    const red = rgb[index * 3] / 255;
    const green = rgb[index * 3 + 1] / 255;
    const blue = rgb[index * 3 + 2] / 255;
    const electric = Math.max(blue, green * 0.82, red * 0.42);
    intensity[index] = Math.pow(clamp(electric * 0.78 + green * 0.16 + red * 0.06, 0, 1), 0.78);
  }
  const smoothed = blurFloat(intensity, WIDTH, HEIGHT, 1);
  const gradientX = new Float32Array(intensity.length);
  const gradientY = new Float32Array(intensity.length);
  for (let y = 1; y < HEIGHT - 1; y += 1) {
    for (let x = 1; x < WIDTH - 1; x += 1) {
      const index = y * WIDTH + x;
      gradientX[index] = (
        -smoothed[index - WIDTH - 1] + smoothed[index - WIDTH + 1]
        - 2 * smoothed[index - 1] + 2 * smoothed[index + 1]
        - smoothed[index + WIDTH - 1] + smoothed[index + WIDTH + 1]
      ) * 0.125;
      gradientY[index] = (
        -smoothed[index - WIDTH - 1] - 2 * smoothed[index - WIDTH] - smoothed[index - WIDTH + 1]
        + smoothed[index + WIDTH - 1] + 2 * smoothed[index + WIDTH] + smoothed[index + WIDTH + 1]
      ) * 0.125;
    }
  }
  const tensorXX = new Float32Array(intensity.length);
  const tensorYY = new Float32Array(intensity.length);
  const tensorXY = new Float32Array(intensity.length);
  for (let index = 0; index < intensity.length; index += 1) {
    tensorXX[index] = gradientX[index] * gradientX[index];
    tensorYY[index] = gradientY[index] * gradientY[index];
    tensorXY[index] = gradientX[index] * gradientY[index];
  }
  const xx = blurFloat(tensorXX, WIDTH, HEIGHT, 2);
  const yy = blurFloat(tensorYY, WIDTH, HEIGHT, 2);
  const xy = blurFloat(tensorXY, WIDTH, HEIGHT, 2);
  const cos2Tangent = new Float32Array(intensity.length);
  const sin2Tangent = new Float32Array(intensity.length);
  const coherence = new Float32Array(intensity.length);
  for (let index = 0; index < intensity.length; index += 1) {
    const difference = xx[index] - yy[index];
    const doubleCross = 2 * xy[index];
    const energy = xx[index] + yy[index] + 1e-8;
    const magnitude = Math.sqrt(difference * difference + doubleCross * doubleCross);
    const gradientAngle = Math.atan2(doubleCross, difference);
    cos2Tangent[index] = -Math.cos(gradientAngle);
    sin2Tangent[index] = -Math.sin(gradientAngle);
    coherence[index] = clamp(magnitude / energy, 0, 1);
  }
  const ridge = new Float32Array(intensity.length);
  for (let y = 2; y < HEIGHT - 2; y += 1) {
    for (let x = 2; x < WIDTH - 2; x += 1) {
      const index = y * WIDTH + x;
      const angle = 0.5 * Math.atan2(sin2Tangent[index], cos2Tangent[index]);
      const tangentX = Math.cos(angle);
      const tangentY = Math.sin(angle);
      const normalX = -tangentY;
      const normalY = tangentX;
      const centre = intensity[index];
      const acrossLeft = bilinear(intensity, x - normalX * 1.35, y - normalY * 1.35);
      const acrossRight = bilinear(intensity, x + normalX * 1.35, y + normalY * 1.35);
      const maximum = centre >= acrossLeft * 0.94 && centre >= acrossRight * 0.94 ? 1 : 0.18;
      ridge[index] = Math.pow(centre, 0.82) * (0.22 + coherence[index] * 0.78) * maximum;
    }
  }
  return { intensity, ridge, coherence, cos2Tangent, sin2Tangent, density: blurFloat(intensity, WIDTH, HEIGHT, 4) };
}

function transformPoint(point, alignment) {
  const localX = (point.x - SVG_VIEWBOX.centerX) * alignment.scaleX;
  const localY = (point.y - SVG_VIEWBOX.centerY) * alignment.scaleY;
  const radians = alignment.rotationDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: alignment.centerX + localX * cosine - localY * sine,
    y: alignment.centerY + localX * sine + localY * cosine,
  };
}

function alignmentScore(components, density, alignment, origin) {
  let sum = 0;
  let weightSum = 0;
  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const component = components[componentIndex];
    const weight = componentIndex === 0 ? 1 : 1.7;
    const stride = Math.max(1, Math.floor(component.points.length / (componentIndex === 0 ? 260 : 110)));
    for (let index = 0; index < component.points.length; index += stride) {
      const point = transformPoint(component.points[index], alignment);
      if (point.x < 1 || point.x >= WIDTH - 2 || point.y < 1 || point.y >= HEIGHT - 2) return -1e6;
      sum += Math.pow(bilinear(density, point.x, point.y), 0.7) * weight;
      weightSum += weight;
    }
  }
  const regularisation = (
    ((alignment.centerX - origin.centerX) / 70) ** 2
    + ((alignment.centerY - origin.centerY) / 80) ** 2
    + ((alignment.scaleX - origin.scaleX) / 0.16) ** 2
    + ((alignment.scaleY - origin.scaleY) / 0.2) ** 2
    + (alignment.rotationDegrees / 8) ** 2
  ) * 0.005;
  return sum / Math.max(1, weightSum) - regularisation;
}

function alignMask(components, density) {
  const origin = { centerX: 323, centerY: 375, scaleX: 0.68, scaleY: 0.86, rotationDegrees: 0 };
  let current = { ...origin };
  let best = alignmentScore(components, density, current, origin);
  let steps = { centerX: 14, centerY: 16, scaleX: 0.045, scaleY: 0.055, rotationDegrees: 2.4 };
  for (let iteration = 0; iteration < 7; iteration += 1) {
    for (const key of ["centerX", "centerY", "scaleX", "scaleY", "rotationDegrees"]) {
      for (const direction of [-1, 1]) {
        const candidate = { ...current, [key]: current[key] + steps[key] * direction };
        const score = alignmentScore(components, density, candidate, origin);
        if (score > best) { current = candidate; best = score; }
      }
    }
    steps = Object.fromEntries(Object.entries(steps).map(([key, value]) => [key, value * 0.58]));
  }
  return { ...current, score: best };
}

function fillPolygon(mask, points) {
  const minimumY = clamp(Math.floor(Math.min(...points.map(({ y }) => y))), 0, HEIGHT - 1);
  const maximumY = clamp(Math.ceil(Math.max(...points.map(({ y }) => y))), 0, HEIGHT - 1);
  for (let y = minimumY; y <= maximumY; y += 1) {
    const scanY = y + 0.5;
    const intersections = [];
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const left = points[previous];
      const right = points[index];
      if ((left.y > scanY) === (right.y > scanY)) continue;
      intersections.push(left.x + ((scanY - left.y) * (right.x - left.x)) / (right.y - left.y));
    }
    intersections.sort((left, right) => left - right);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const start = clamp(Math.ceil(intersections[index]), 0, WIDTH - 1);
      const end = clamp(Math.floor(intersections[index + 1]), 0, WIDTH - 1);
      for (let x = start; x <= end; x += 1) mask[y * WIDTH + x] = 1;
    }
  }
}

function dilate(mask, radius) {
  const horizontal = new Uint8Array(mask.length);
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      let active = 0;
      for (let dx = -radius; dx <= radius && !active; dx += 1) active = mask[y * WIDTH + clamp(x + dx, 0, WIDTH - 1)];
      horizontal[y * WIDTH + x] = active;
    }
  }
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      let active = 0;
      for (let dy = -radius; dy <= radius && !active; dy += 1) active = horizontal[clamp(y + dy, 0, HEIGHT - 1) * WIDTH + x];
      output[y * WIDTH + x] = active;
    }
  }
  return output;
}

function rasterizeMask(components, alignment) {
  const componentMasks = {};
  const transformed = [];
  const union = new Uint8Array(WIDTH * HEIGHT);
  for (const component of components) {
    const points = component.points.map((point) => transformPoint(point, alignment));
    const mask = new Uint8Array(WIDTH * HEIGHT);
    fillPolygon(mask, points);
    componentMasks[component.id] = mask;
    transformed.push({ id: component.id, points });
    for (let index = 0; index < union.length; index += 1) if (mask[index]) union[index] = 1;
  }
  return {
    union,
    expanded: dilate(union, 7),
    componentMasks,
    expandedComponents: Object.fromEntries(COMPONENT_IDS.map((id) => [id, dilate(componentMasks[id], id === "sole" ? 6 : 4)])),
    transformed,
    componentBounds: Object.fromEntries(COMPONENT_IDS.map((id) => [id, componentBounds(componentMasks[id])])),
  };
}

function componentAt(maskData, x, y) {
  const sampleX = Math.floor(x);
  const sampleY = Math.floor(y);
  if (sampleX < 0 || sampleX >= WIDTH || sampleY < 0 || sampleY >= HEIGHT) return "";
  const index = sampleY * WIDTH + sampleX;
  for (const id of COMPONENT_IDS) if (maskData.componentMasks[id][index]) return id;
  return "";
}

function wakeAllowed(maskData, fields, x, y) {
  const sampleX = Math.floor(x);
  const sampleY = Math.floor(y);
  if (sampleX < 2 || sampleX >= WIDTH - 2 || sampleY < 2 || sampleY >= HEIGHT - 2) return false;
  const index = sampleY * WIDTH + sampleX;
  if (maskData.expanded[index]) {
    const component = componentAt(maskData, x, y);
    return !component.startsWith("toe");
  }
  const upperLeftEnvelope = x < 355 - y * 0.08 && y < 640;
  const middleWake = x < 310 && y > 210 && y < 610;
  return (upperLeftEnvelope || middleWake) && fields.intensity[index] > 0.0045;
}

function toeGapAllowed(maskData, component, x, y) {
  if (!component.startsWith("toe")) return true;
  const bounds = maskData.componentBounds[component];
  const centreX = (bounds.minimumX + bounds.maximumX) * 0.5;
  const centreY = (bounds.minimumY + bounds.maximumY) * 0.5;
  const radiusX = Math.max(1, (bounds.maximumX - bounds.minimumX) * 0.5);
  const radiusY = Math.max(1, (bounds.maximumY - bounds.minimumY) * 0.5);
  const normalizedX = (x - centreX) / radiusX;
  const normalizedY = (y - centreY) / radiusY;
  const radius = vectorLength(normalizedX, normalizedY);
  if (radius < 0.42) return true;
  const toeIndex = Number(component.split("-")[1]) - 1;
  const gapAngles = [-2.45, -2.4, -2.35, -2.3, -2.25];
  const halfWidths = [0.58, 0.62, 0.65, 0.68, 0.72];
  const angle = Math.atan2(normalizedY, normalizedX);
  const difference = Math.atan2(Math.sin(angle - gapAngles[toeIndex]), Math.cos(angle - gapAngles[toeIndex]));
  return Math.abs(difference) > halfWidths[toeIndex];
}

function anatomyAllowed(maskData, x, y, component) {
  const sampleX = Math.floor(x);
  const sampleY = Math.floor(y);
  return sampleX >= 0
    && sampleX < WIDTH
    && sampleY >= 0
    && sampleY < HEIGHT
    && Boolean(maskData.expandedComponents[component][sampleY * WIDTH + sampleX])
    && toeGapAllowed(maskData, component, x, y);
}

function sampleDirection(fields, x, y, previousX, previousY, directionSign, variation, variationAmount) {
  const cosine = bilinear(fields.cos2Tangent, x, y);
  const sine = bilinear(fields.sin2Tangent, x, y);
  const phase = variation * Math.PI * 2;
  const directionalVariation = (
    Math.sin(x * 0.031 + y * 0.023 + phase) * 0.64
    + Math.sin(x * 0.013 - y * 0.027 + phase * 1.71) * 0.36
  ) * variationAmount;
  const angle = 0.5 * Math.atan2(sine, cosine) + directionalVariation;
  let directionX = Math.cos(angle) * directionSign;
  let directionY = Math.sin(angle) * directionSign;
  if (previousX !== null && directionX * previousX + directionY * previousY < 0) { directionX *= -1; directionY *= -1; }
  if (previousX !== null) {
    directionX = previousX * 0.58 + directionX * 0.42;
    directionY = previousY * 0.58 + directionY * 0.42;
  }
  const length = vectorLength(directionX, directionY) || 1;
  return { x: directionX / length, y: directionY / length };
}

function traceDirection(seed, directionSign, maxSteps, component, fields, maskData, variation) {
  const points = [];
  let x = seed.x;
  let y = seed.y;
  let previousX = null;
  let previousY = null;
  let lowSignalSteps = 0;
  for (let step = 0; step < maxSteps; step += 1) {
    const mode = component === "wake" ? "wake" : "anatomy";
    const permitted = mode === "wake" ? wakeAllowed(maskData, fields, x, y) : anatomyAllowed(maskData, x, y, component);
    if (!permitted) break;
    const signal = bilinear(fields.ridge, x, y);
    lowSignalSteps = signal < (mode === "wake" ? 0.0028 : 0.0028) ? lowSignalSteps + 1 : 0;
    if (lowSignalSteps > (mode === "wake" ? 7 : 7)) break;
    points.push({ x, y });
    const direction = sampleDirection(fields, x, y, previousX, previousY, directionSign, variation, component === "wake" ? 0.105 : 0.075);
    const normalX = -direction.y;
    const normalY = direction.x;
    let bestOffset = 0;
    let bestResponse = bilinear(fields.intensity, x + direction.x * 1.15, y + direction.y * 1.15);
    for (const offset of [-1.35, -0.7, 0.7, 1.35]) {
      const response = bilinear(fields.intensity, x + direction.x * 1.15 + normalX * offset, y + direction.y * 1.15 + normalY * offset);
      if (response > bestResponse) { bestResponse = response; bestOffset = offset; }
    }
    const lateralDrift = Math.sin(step * 0.17 + variation * Math.PI * 2) * (component === "wake" ? 0.14 : 0.1);
    x += direction.x * 1.15 + normalX * (bestOffset * 0.1 + lateralDrift);
    y += direction.y * 1.15 + normalY * (bestOffset * 0.1 + lateralDrift);
    previousX = direction.x;
    previousY = direction.y;
    if (points.length > 16) {
      const recent = points[points.length - 14];
      if (vectorLength(x - recent.x, y - recent.y) < 3.2) break;
    }
  }
  return points;
}

function curveLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += vectorLength(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  return length;
}

function fanCurve(points, seed, component, fields, maskData) {
  const variation = hash(seed.x, seed.y, component.length + 41);
  const phase = hash(seed.y, seed.x, component.length + 53) * Math.PI * 2;
  const maximumOffset = component === "wake" ? 10 : component.startsWith("toe") ? 5 : 8;
  const baseOffset = (variation * 2 - 1) * maximumOffset;
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const tangentLength = vectorLength(after.x - before.x, after.y - before.y) || 1;
    const normalX = -(after.y - before.y) / tangentLength;
    const normalY = (after.x - before.x) / tangentLength;
    const progress = index / Math.max(1, points.length - 1);
    const envelope = 0.42 + Math.pow(Math.sin(progress * Math.PI), 0.72) * 0.58;
    const offset = baseOffset * envelope + Math.sin(index * 0.31 + phase) * maximumOffset * 0.11;
    for (const scale of [1, 0.62, 0.34]) {
      const candidate = { x: point.x + normalX * offset * scale, y: point.y + normalY * offset * scale };
      const allowed = component === "wake"
        ? wakeAllowed(maskData, fields, candidate.x, candidate.y)
        : anatomyAllowed(maskData, candidate.x, candidate.y, component);
      if (allowed) return candidate;
    }
    return point;
  });
}

function createCurve(seed, component, fields, maskData, rgb) {
  const seedNoise = hash(seed.x, seed.y, component.length);
  const flowVariation = hash(seed.y, seed.x, component.length + 23);
  const totalSteps = Math.floor((component === "wake" ? 55 : 24) + seedNoise * (component === "wake" ? 230 : 96));
  const backwardSteps = Math.floor(totalSteps * (0.34 + hash(seed.y, seed.x, 2) * 0.32));
  const forwardSteps = Math.max(8, totalSteps - backwardSteps);
  const backward = traceDirection(seed, -1, backwardSteps, component, fields, maskData, flowVariation).reverse();
  const forward = traceDirection(seed, 1, forwardSteps, component, fields, maskData, flowVariation);
  let points = [...backward.slice(0, -1), ...forward];
  if (points.length < 8) return null;
  let length = curveLength(points);
  if (length < (component === "wake" ? 15 : 9)) return null;
  const endpointDistance = vectorLength(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  if (endpointDistance < Math.max(5, length * 0.055)) {
    const start = Math.floor(points.length * 0.13);
    const end = Math.ceil(points.length * 0.84);
    points = points.slice(start, end);
    length = curveLength(points);
  }
  if (seedNoise < 0.24 && points.length > 20) {
    const shortSpan = 9 + Math.floor(hash(seed.y, seed.x, 11) * 11);
    const centre = Math.floor(points.length * (0.36 + hash(seed.x, seed.y, 12) * 0.28));
    const start = clamp(centre - Math.floor(shortSpan / 2), 0, points.length - shortSpan);
    points = points.slice(start, start + shortSpan);
    length = curveLength(points);
  }
  let sampled = [];
  for (let index = 0; index < points.length; index += 2) sampled.push(points[index]);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
  if (sampled.length < 5) return null;
  sampled = fanCurve(sampled, seed, component, fields, maskData);
  if (vectorLength(sampled[0].x - sampled[sampled.length - 1].x, sampled[0].y - sampled[sampled.length - 1].y) < 4) return null;
  let meanIntensity = 0;
  let meanBlue = 0;
  let meanGreen = 0;
  for (const point of sampled) {
    meanIntensity += bilinear(fields.intensity, point.x, point.y);
    const x = clamp(Math.round(point.x), 0, WIDTH - 1);
    const y = clamp(Math.round(point.y), 0, HEIGHT - 1);
    const pixel = (y * WIDTH + x) * 3;
    meanGreen += rgb[pixel + 1] / 255;
    meanBlue += rgb[pixel + 2] / 255;
  }
  meanIntensity /= sampled.length;
  meanGreen /= sampled.length;
  meanBlue /= sampled.length;
  const brightness = clamp(Math.pow(meanIntensity, 0.72), 0, 1);
  const colour = brightness > 0.86 ? 3 : brightness > 0.62 || meanGreen > meanBlue * 0.7 ? 2 : brightness > 0.25 ? 1 : 0;
  const width = clamp(0.28 + brightness * 0.82 + hash(seed.x, seed.y, 9) * 0.34, 0.28, 1.38);
  const alpha = clamp(0.1 + brightness * 0.46 + hash(seed.y, seed.x, 7) * 0.1, 0.1, 0.66);
  return {
    component,
    kind: component === "wake" ? "wake" : component.startsWith("toe") ? "toe" : "sole",
    width: Number(width.toFixed(3)),
    alpha: Number(alpha.toFixed(3)),
    colour,
    length: Number((length / HEIGHT).toFixed(5)),
    points: sampled.flatMap((point) => [Number((point.x / WIDTH).toFixed(6)), Number((1 - point.y / HEIGHT).toFixed(6))]),
    sourcePoints: sampled,
  };
}

function markOccupancy(occupancy, points, radius) {
  for (const point of points) {
    const centreX = Math.round(point.x);
    const centreY = Math.round(point.y);
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const x = centreX + offsetX;
        const y = centreY + offsetY;
        if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && offsetX * offsetX + offsetY * offsetY <= radius * radius + 0.5) occupancy[y * WIDTH + x] = Math.min(255, occupancy[y * WIDTH + x] + 1);
      }
    }
  }
}

function occupancyRatio(occupancy, points) {
  let occupied = 0;
  for (const point of points) {
    const x = clamp(Math.round(point.x), 0, WIDTH - 1);
    const y = clamp(Math.round(point.y), 0, HEIGHT - 1);
    if (occupancy[y * WIDTH + x]) occupied += 1;
  }
  return occupied / points.length;
}

function makeSeeds(fields, maskData) {
  const byComponent = Object.fromEntries([...COMPONENT_IDS, "wake"].map((id) => [id, []]));
  for (let y = 2; y < HEIGHT - 2; y += 1) {
    for (let x = 2; x < WIDTH - 2; x += 1) {
      const index = y * WIDTH + x;
      const ridge = fields.ridge[index];
      if (ridge < 0.012) continue;
      const component = componentAt(maskData, x, y);
      if (component) {
        byComponent[component].push({ x, y, score: ridge * (0.82 + hash(x, y, 1) * 0.36) });
      } else if (wakeAllowed(maskData, fields, x, y) && !maskData.expanded[index]) {
        byComponent.wake.push({ x, y, score: ridge * (0.78 + hash(x, y, 3) * 0.42) });
      }
    }
  }
  for (const transformed of maskData.transformed) {
    const stride = transformed.id === "sole" ? 3 : 2;
    for (let index = 0; index < transformed.points.length; index += stride) {
      const point = transformed.points[index];
      if (point.x < 2 || point.x >= WIDTH - 2 || point.y < 2 || point.y >= HEIGHT - 2) continue;
      const response = bilinear(fields.ridge, point.x, point.y);
      byComponent[transformed.id].push({ x: point.x, y: point.y, score: Math.max(0.015, response) * 1.22 });
    }
  }
  for (const seeds of Object.values(byComponent)) seeds.sort((left, right) => right.score - left.score);
  return byComponent;
}

function traceCurves(fields, maskData, rgb) {
  const candidates = makeSeeds(fields, maskData);
  const curves = [];
  const counts = {};
  for (const component of [...COMPONENT_IDS, "wake"]) {
    const occupancy = new Uint8Array(WIDTH * HEIGHT);
    const target = TARGET_COUNTS[component];
    const isToe = component.startsWith("toe");
    let accepted = 0;
    for (const seed of candidates[component]) {
      if (accepted >= target) break;
      const index = Math.floor(seed.y) * WIDTH + Math.floor(seed.x);
      if (occupancy[index] > (component === "wake" ? 3 : isToe ? 4 : 3)) continue;
      const curve = createCurve(seed, component, fields, maskData, rgb);
      if (!curve) continue;
      const overlap = occupancyRatio(occupancy, curve.sourcePoints);
      if (overlap > (component === "wake" ? 0.84 : isToe ? 0.88 : 0.82)) continue;
      curves.push(curve);
      markOccupancy(occupancy, curve.sourcePoints, component === "wake" || isToe ? 1 : accepted % 4 === 0 ? 2 : 1);
      accepted += 1;
    }
    counts[component] = accepted;
  }
  return { curves, counts, candidateCounts: Object.fromEntries(Object.entries(candidates).map(([id, values]) => [id, values.length])) };
}

function componentBounds(mask) {
  let minimumX = WIDTH;
  let minimumY = HEIGHT;
  let maximumX = -1;
  let maximumY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    minimumX = Math.min(minimumX, x);
    minimumY = Math.min(minimumY, y);
    maximumX = Math.max(maximumX, x);
    maximumY = Math.max(maximumY, y);
  }
  return { minimumX, minimumY, maximumX, maximumY };
}

function makeFocus(maskData) {
  const combinedToes = new Uint8Array(WIDTH * HEIGHT);
  for (const id of COMPONENT_IDS.slice(1)) {
    const mask = maskData.componentMasks[id];
    for (let index = 0; index < mask.length; index += 1) if (mask[index]) combinedToes[index] = 1;
  }
  const toes = componentBounds(combinedToes);
  const sole = componentBounds(maskData.componentMasks.sole);
  const focus = (bounds, padding = 1.28) => {
    const width = (bounds.maximumX - bounds.minimumX + 1) / WIDTH;
    const height = (bounds.maximumY - bounds.minimumY + 1) / HEIGHT;
    return {
      center: [Number((((bounds.minimumX + bounds.maximumX) * 0.5) / WIDTH).toFixed(5)), Number((1 - ((bounds.minimumY + bounds.maximumY) * 0.5) / HEIGHT).toFixed(5))],
      scale: Number((1 / Math.max(width * padding, height * padding)).toFixed(4)),
    };
  };
  return {
    full: { center: [0.5, 0.5], scale: 1 },
    toes: focus(toes, 1.22),
    arch: { center: [Number(((sole.minimumX + sole.maximumX) * 0.54 / WIDTH).toFixed(5)), 0.48], scale: 2.05 },
    heel: { center: [Number((sole.maximumX * 0.87 / WIDTH).toFixed(5)), Number((1 - sole.maximumY * 0.91 / HEIGHT).toFixed(5))], scale: 2.25 },
  };
}

function drawLine(image, left, right, colour, alpha, radius = 0) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const steps = Math.max(1, Math.ceil(vectorLength(dx, dy) * 1.8));
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(left.x + dx * (step / steps));
    const y = Math.round(left.y + dy * (step / steps));
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const targetX = x + offsetX;
        const targetY = y + offsetY;
        if (targetX < 0 || targetX >= WIDTH || targetY < 0 || targetY >= HEIGHT) continue;
        const falloff = radius ? clamp(1 - vectorLength(offsetX, offsetY) / (radius + 0.7), 0.12, 1) : 1;
        const pixel = (targetY * WIDTH + targetX) * 3;
        for (let channel = 0; channel < 3; channel += 1) image[pixel + channel] = clamp(image[pixel + channel] + colour[channel] * alpha * falloff, 0, 255);
      }
    }
  }
}

function tracePreview(curves, alphaScale = 0.62) {
  const image = new Uint8Array(WIDTH * HEIGHT * 3);
  const palette = [[12, 70, 255], [8, 140, 255], [18, 220, 255], [205, 248, 255]];
  for (const curve of curves) {
    const colour = palette[curve.colour];
    for (let index = 1; index < curve.sourcePoints.length; index += 1) {
      drawLine(image, curve.sourcePoints[index - 1], curve.sourcePoints[index], colour, curve.alpha * alphaScale, curve.width > 1.12 ? 1 : 0);
    }
  }
  return image;
}

function alignmentPreview(fields, maskData) {
  const image = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = y * WIDTH + x;
      const pixel = index * 3;
      const value = clamp(fields.intensity[index] * 150, 0, 180);
      image[pixel] = value * 0.08;
      image[pixel + 1] = value * 0.44;
      image[pixel + 2] = value;
      if (maskData.union[index]) {
        const edge = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1
          || !maskData.union[index - 1] || !maskData.union[index + 1] || !maskData.union[index - WIDTH] || !maskData.union[index + WIDTH];
        if (edge) { image[pixel] = 244; image[pixel + 1] = 72; image[pixel + 2] = 190; }
      }
    }
  }
  return image;
}

function ridgePreview(fields) {
  let maximum = 0;
  for (const value of fields.ridge) maximum = Math.max(maximum, value);
  return Uint8Array.from(fields.ridge, (value) => clamp(Math.round((value / Math.max(maximum, 1e-8)) ** 0.55 * 255), 0, 255));
}

function makePngGenerationDomain(fields) {
  const support = new Float32Array(WIDTH * HEIGHT);
  const core = new Uint8Array(WIDTH * HEIGHT);
  const thresholds = {
    intensity: 0.015,
    ridge: 0.01,
    coherentDensity: 0.0095,
    coherentDensityMinimum: 0.18,
    dilationPixels: 1,
  };
  let corePixelCount = 0;
  let maximumSupport = 0;
  for (let index = 0; index < support.length; index += 1) {
    support[index] = Math.max(fields.intensity[index], fields.ridge[index] * 0.92, fields.density[index] * 0.7);
    maximumSupport = Math.max(maximumSupport, support[index]);
    const active = fields.intensity[index] >= thresholds.intensity
      || fields.ridge[index] >= thresholds.ridge
      || (fields.density[index] >= thresholds.coherentDensity && fields.coherence[index] >= thresholds.coherentDensityMinimum);
    if (active) {
      core[index] = 1;
      corePixelCount += 1;
    }
  }
  const allowed = dilate(core, thresholds.dilationPixels);
  let allowedPixelCount = 0;
  for (const value of allowed) allowedPixelCount += value;
  return { support, core, allowed, thresholds, corePixelCount, allowedPixelCount, maximumSupport };
}

function pngDomainAllowed(domain, x, y) {
  const sampleX = Math.floor(x);
  const sampleY = Math.floor(y);
  return sampleX >= 2
    && sampleX < WIDTH - 2
    && sampleY >= 2
    && sampleY < HEIGHT - 2
    && Boolean(domain.allowed[sampleY * WIDTH + sampleX]);
}

function zoneLabelAt(maskData, x, y) {
  const sampleX = Math.floor(x);
  const sampleY = Math.floor(y);
  if (sampleX < 0 || sampleX >= WIDTH || sampleY < 0 || sampleY >= HEIGHT) return "wake";
  const index = sampleY * WIDTH + sampleX;
  const priority = [...COMPONENT_IDS.slice(1), "sole"];
  for (const id of priority) if (maskData.componentMasks[id][index]) return id;
  for (const id of priority) if (maskData.expandedComponents[id][index]) return id;
  return "wake";
}

function tracePngDirection(seed, directionSign, maxSteps, fields, domain, variation) {
  const points = [];
  let x = seed.x;
  let y = seed.y;
  let previousX = null;
  let previousY = null;
  let lowSignalSteps = 0;
  for (let step = 0; step < maxSteps; step += 1) {
    if (!pngDomainAllowed(domain, x, y)) break;
    const ridge = bilinear(fields.ridge, x, y);
    const support = bilinear(domain.support, x, y);
    lowSignalSteps = ridge < 0.003 && support < 0.008 ? lowSignalSteps + 1 : 0;
    if (lowSignalSteps > 5) break;
    points.push({ x, y });
    const coherence = bilinear(fields.coherence, x, y);
    const direction = sampleDirection(fields, x, y, previousX, previousY, directionSign, variation, 0.038 + (1 - coherence) * 0.025);
    if (previousX !== null) {
      const turn = Math.acos(clamp(direction.x * previousX + direction.y * previousY, -1, 1));
      seed.accumulatedTurn = (seed.accumulatedTurn ?? 0) + turn;
      if (seed.accumulatedTurn > 1.45 + variation * 0.95) break;
    }
    const normalX = -direction.y;
    const normalY = direction.x;
    let bestOffset = 0;
    let bestResponse = bilinear(fields.intensity, x + direction.x * 1.08, y + direction.y * 1.08);
    for (const offset of [-1.25, -0.62, 0.62, 1.25]) {
      const candidateX = x + direction.x * 1.08 + normalX * offset;
      const candidateY = y + direction.y * 1.08 + normalY * offset;
      if (!pngDomainAllowed(domain, candidateX, candidateY)) continue;
      const response = bilinear(fields.intensity, candidateX, candidateY);
      if (response > bestResponse) { bestResponse = response; bestOffset = offset; }
    }
    const lateralDrift = Math.sin(step * 0.173 + variation * Math.PI * 2) * 0.075;
    x += direction.x * 1.08 + normalX * (bestOffset * 0.115 + lateralDrift);
    y += direction.y * 1.08 + normalY * (bestOffset * 0.115 + lateralDrift);
    previousX = direction.x;
    previousY = direction.y;
    if (points.length > 16) {
      const recent = points[points.length - 14];
      if (vectorLength(x - recent.x, y - recent.y) < 3.1) break;
    }
  }
  return points;
}

function fanPngCurve(points, seed, fields, domain) {
  const variation = hash(seed.x, seed.y, 71);
  const phase = hash(seed.y, seed.x, 83) * Math.PI * 2;
  const maximumOffset = 2.4 + hash(seed.x, seed.y, 89) * 3.8;
  const baseOffset = (variation * 2 - 1) * maximumOffset;
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const tangentLength = vectorLength(after.x - before.x, after.y - before.y) || 1;
    const normalX = -(after.y - before.y) / tangentLength;
    const normalY = (after.x - before.x) / tangentLength;
    const progress = index / Math.max(1, points.length - 1);
    const envelope = 0.35 + Math.pow(Math.sin(progress * Math.PI), 0.78) * 0.65;
    const offset = baseOffset * envelope + Math.sin(index * 0.29 + phase) * maximumOffset * 0.08;
    for (const scale of [1, 0.56, 0.24]) {
      const candidate = { x: point.x + normalX * offset * scale, y: point.y + normalY * offset * scale };
      if (pngDomainAllowed(domain, candidate.x, candidate.y)) return candidate;
    }
    return point;
  });
}

function createPngCurve(seed, fields, domain, rgb) {
  const seedNoise = hash(seed.x, seed.y, 97);
  const flowVariation = hash(seed.y, seed.x, 101);
  const localCoherence = bilinear(fields.coherence, seed.x, seed.y);
  const maximumSpan = 92 + 142 * (0.45 + localCoherence * 0.55);
  const totalSteps = Math.floor(24 + seedNoise * maximumSpan);
  const backwardSteps = Math.floor(totalSteps * (0.34 + hash(seed.y, seed.x, 103) * 0.32));
  const forwardSteps = Math.max(8, totalSteps - backwardSteps);
  const backward = tracePngDirection({ ...seed, accumulatedTurn: 0 }, -1, backwardSteps, fields, domain, flowVariation).reverse();
  const forward = tracePngDirection({ ...seed, accumulatedTurn: 0 }, 1, forwardSteps, fields, domain, flowVariation);
  let points = [...backward.slice(0, -1), ...forward];
  if (points.length < 8) return null;
  let length = curveLength(points);
  if (length < 10) return null;
  const endpointDistance = vectorLength(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  if (endpointDistance < Math.max(5, length * 0.058)) {
    const start = Math.floor(points.length * 0.13);
    const end = Math.ceil(points.length * 0.84);
    points = points.slice(start, end);
  }
  if (seedNoise < 0.38 && points.length > 20) {
    const shortSpan = 9 + Math.floor(hash(seed.y, seed.x, 107) * 12);
    const centre = Math.floor(points.length * (0.35 + hash(seed.x, seed.y, 109) * 0.3));
    const start = clamp(centre - Math.floor(shortSpan / 2), 0, points.length - shortSpan);
    points = points.slice(start, start + shortSpan);
  }
  let sampled = [];
  for (let index = 0; index < points.length; index += 2) sampled.push(points[index]);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
  if (sampled.length < 5) return null;
  sampled = fanPngCurve(sampled, seed, fields, domain);
  let accumulatedTurn = 0;
  for (let index = 2; index < sampled.length; index += 1) {
    const firstX = sampled[index - 1].x - sampled[index - 2].x;
    const firstY = sampled[index - 1].y - sampled[index - 2].y;
    const secondX = sampled[index].x - sampled[index - 1].x;
    const secondY = sampled[index].y - sampled[index - 1].y;
    const denominator = vectorLength(firstX, firstY) * vectorLength(secondX, secondY) || 1;
    accumulatedTurn += Math.acos(clamp((firstX * secondX + firstY * secondY) / denominator, -1, 1));
  }
  if (accumulatedTurn > 2.65 && sampled.length > 14) {
    const span = Math.max(10, Math.floor(sampled.length * (0.46 + hash(seed.x, seed.y, 111) * 0.18)));
    const available = sampled.length - span;
    const start = Math.floor(hash(seed.y, seed.x, 112) * Math.max(1, available));
    sampled = sampled.slice(start, start + span);
  }
  length = curveLength(sampled);
  const sampledEndpointDistance = vectorLength(sampled[0].x - sampled[sampled.length - 1].x, sampled[0].y - sampled[sampled.length - 1].y);
  if (sampledEndpointDistance < Math.max(4, length * 0.045)) return null;
  let meanIntensity = 0;
  let meanBlue = 0;
  let meanGreen = 0;
  for (const point of sampled) {
    meanIntensity += bilinear(fields.intensity, point.x, point.y);
    const x = clamp(Math.round(point.x), 0, WIDTH - 1);
    const y = clamp(Math.round(point.y), 0, HEIGHT - 1);
    const pixel = (y * WIDTH + x) * 3;
    meanGreen += rgb[pixel + 1] / 255;
    meanBlue += rgb[pixel + 2] / 255;
  }
  meanIntensity /= sampled.length;
  meanGreen /= sampled.length;
  meanBlue /= sampled.length;
  const brightness = clamp(Math.pow(meanIntensity, 0.72), 0, 1);
  const colour = brightness > 0.86 ? 3 : brightness > 0.62 || meanGreen > meanBlue * 0.7 ? 2 : brightness > 0.25 ? 1 : 0;
  const width = clamp(0.26 + brightness * 0.78 + hash(seed.x, seed.y, 113) * 0.31, 0.26, 1.32);
  const alpha = clamp(0.1 + brightness * 0.46 + hash(seed.y, seed.x, 127) * 0.1, 0.1, 0.66);
  return {
    component: seed.zone,
    kind: seed.zone === "wake" ? "wake" : seed.zone.startsWith("toe") ? "toe" : "sole",
    width: Number(width.toFixed(3)),
    alpha: Number(alpha.toFixed(3)),
    colour,
    length: Number((length / HEIGHT).toFixed(5)),
    points: sampled.flatMap((point) => [Number((point.x / WIDTH).toFixed(6)), Number((1 - point.y / HEIGHT).toFixed(6))]),
    sourcePoints: sampled,
  };
}

function makePngSeeds(fields, domain, maskData) {
  let maximumRidge = 0;
  for (const value of fields.ridge) maximumRidge = Math.max(maximumRidge, value);
  const ridgeThreshold = Math.max(0.0115, maximumRidge * 0.012);
  const seeds = [];
  const byZone = Object.fromEntries([...COMPONENT_IDS, "wake"].map((id) => [id, 0]));
  for (let y = 2; y < HEIGHT - 2; y += 1) {
    for (let x = 2; x < WIDTH - 2; x += 1) {
      const index = y * WIDTH + x;
      const ridge = fields.ridge[index];
      if (!domain.allowed[index] || ridge < ridgeThreshold) continue;
      const zone = zoneLabelAt(maskData, x, y);
      const score = Math.pow(ridge, 0.54)
        * (0.62 + hash(x, y, 131) * 0.76)
        * (0.72 + fields.coherence[index] * 0.28);
      seeds.push({ x, y, zone, score });
      byZone[zone] += 1;
    }
  }
  seeds.sort((left, right) => right.score - left.score);
  return { seeds, ridgeThreshold, maximumRidge, byZone };
}

function tracePngCurves(fields, domain, maskData, rgb) {
  const candidates = makePngSeeds(fields, domain, maskData);
  const curves = [];
  const occupancy = new Uint8Array(WIDTH * HEIGHT);
  const counts = Object.fromEntries([...COMPONENT_IDS, "wake"].map((id) => [id, 0]));
  for (const seed of candidates.seeds) {
    if (curves.length >= PNG_COMPARISON_CURVE_TARGET) break;
    const index = seed.y * WIDTH + seed.x;
    if (occupancy[index] > 2) continue;
    const curve = createPngCurve(seed, fields, domain, rgb);
    if (!curve) continue;
    const overlap = occupancyRatio(occupancy, curve.sourcePoints);
    if (overlap > 0.68) continue;
    curves.push(curve);
    counts[curve.component] += 1;
    markOccupancy(occupancy, curve.sourcePoints, curves.length % 7 === 0 ? 2 : 1);
  }
  return {
    curves,
    counts,
    candidateCounts: { total: candidates.seeds.length, byZone: candidates.byZone },
    ridgeThreshold: candidates.ridgeThreshold,
    maximumRidge: candidates.maximumRidge,
  };
}

function pngDomainPreview(fields, domain) {
  const image = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let index = 0; index < domain.support.length; index += 1) {
    if (!domain.allowed[index]) continue;
    const value = clamp(Math.round(Math.pow(domain.support[index] / Math.max(domain.maximumSupport, 1e-8), 0.42) * 255), 0, 255);
    image[index * 3] = Math.round(value * 0.05);
    image[index * 3 + 1] = Math.round(value * 0.62);
    image[index * 3 + 2] = value;
  }
  return image;
}

function pngTraceOverlay(rgb, trace) {
  const image = new Uint8Array(rgb.length);
  for (let index = 0; index < image.length; index += 1) image[index] = clamp(Math.round(rgb[index] * 0.34 + trace[index] * 0.92), 0, 255);
  return image;
}

function equalScaleComparison(rgb, trace) {
  const gutter = 8;
  const outputWidth = WIDTH * 2 + gutter;
  const image = new Uint8Array(outputWidth * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const target = (y * outputWidth + x) * 3;
      if (x < WIDTH) {
        const source = (y * WIDTH + x) * 3;
        image[target] = rgb[source];
        image[target + 1] = rgb[source + 1];
        image[target + 2] = rgb[source + 2];
      } else if (x >= WIDTH + gutter) {
        const source = (y * WIDTH + x - WIDTH - gutter) * 3;
        image[target] = trace[source];
        image[target + 1] = trace[source + 1];
        image[target + 2] = trace[source + 2];
      } else {
        image[target] = 4;
        image[target + 1] = 14;
        image[target + 2] = 26;
      }
    }
  }
  return { width: outputWidth, image };
}

function stripSourcePoints(curves) {
  return curves.map(({ sourcePoints, ...curve }) => curve);
}

function makeApprovedCurveFocus(curves) {
  const focusFor = (curveFilter, pointFilter, padding) => {
    let minimumX = 1;
    let minimumY = 1;
    let maximumX = 0;
    let maximumY = 0;
    let found = false;
    for (const curve of curves) {
      if (!curveFilter(curve)) continue;
      for (let index = 0; index < curve.points.length; index += 2) {
        const x = curve.points[index];
        const y = curve.points[index + 1];
        if (!pointFilter(x, y)) continue;
        found = true;
        minimumX = Math.min(minimumX, x);
        minimumY = Math.min(minimumY, y);
        maximumX = Math.max(maximumX, x);
        maximumY = Math.max(maximumY, y);
      }
    }
    if (!found) return { center: [0.5, 0.5], scale: 1 };
    const width = Math.max(0.01, maximumX - minimumX);
    const height = Math.max(0.01, maximumY - minimumY);
    return {
      center: [Number(((minimumX + maximumX) * 0.5).toFixed(5)), Number(((minimumY + maximumY) * 0.5).toFixed(5))],
      scale: Number((1 / Math.max(width * padding, height * padding)).toFixed(4)),
    };
  };
  return {
    full: { center: [0.5, 0.5], scale: 1 },
    toes: focusFor((curve) => curve.kind === "toe", () => true, 1.2),
    arch: focusFor(() => true, (x, y) => x >= 0.43 && x <= 0.86 && y >= 0.38 && y <= 0.72, 1.28),
    heel: focusFor(() => true, (x, y) => x >= 0.48 && x <= 0.92 && y >= 0.05 && y <= 0.36, 1.28),
  };
}

const [guideBuffer, svgBuffer] = await Promise.all([readFile(guidePath), readFile(svgPath)]);
const rgb = decodeRgb(guidePath);
const fields = makeImageFields(rgb);
const locked = parseLockedSvg(svgBuffer.toString("utf8"));
const alignment = alignMask(locked.components, fields.density);
const maskData = rasterizeMask(locked.components, alignment);

if (pngComparisonOnly) {
  const domain = makePngGenerationDomain(fields);
  const traced = tracePngCurves(fields, domain, maskData, rgb);
  const curves = traced.curves;
  const trace = tracePreview(curves, 0.24);
  const traceBuffer = encodePng(WIDTH, HEIGHT, trace, 3);
  const comparison = equalScaleComparison(rgb, trace);
  const runtimeCurves = stripSourcePoints(curves);
  const totalPoints = runtimeCurves.reduce((sum, curve) => sum + curve.points.length / 2, 0);
  const segmentCount = runtimeCurves.reduce((sum, curve) => sum + curve.points.length / 2 - 1, 0);
  const closedLikeCount = curves.filter((curve) => {
    const first = curve.sourcePoints[0];
    const last = curve.sourcePoints[curve.sourcePoints.length - 1];
    return vectorLength(first.x - last.x, first.y - last.y) < 4;
  }).length;
  const shortCount = runtimeCurves.filter((curve) => curve.length < 0.02).length;
  const mediumCount = runtimeCurves.filter((curve) => curve.length >= 0.02 && curve.length < 0.09).length;
  const longCount = runtimeCurves.filter((curve) => curve.length >= 0.09).length;
  const finiteCoordinates = runtimeCurves.every((curve) => curve.points.every(Number.isFinite));
  const normalizedCoordinates = runtimeCurves.every((curve) => curve.points.every((value) => value >= -0.02 && value <= 1.02));
  const traceSha256 = sha256(traceBuffer);
  if (curves.length !== APPROVED_PNG_CURVE_COUNT || totalPoints !== APPROVED_PNG_POINT_COUNT || traceSha256 !== APPROVED_PNG_TRACE_SHA256) {
    throw new Error(`Approved PNG geometry lock failed:\n${JSON.stringify({ curves: curves.length, points: totalPoints, traceSha256 }, null, 2)}`);
  }
  const curveDataSha256 = sha256(Buffer.from(JSON.stringify(runtimeCurves)));
  if (curveDataSha256 !== APPROVED_PNG_CURVE_DATA_SHA256) throw new Error(`Approved curve data hash changed: ${curveDataSha256}.`);
  const frozenGeometry = {
    schemaVersion: 2,
    status: "approved-frozen",
    coordinateSystem: { width: WIDTH, height: HEIGHT, normalized: true, yUp: true },
    sources: {
      artisticGuideSha256: sha256(guideBuffer),
      anatomyZonesSha256: sha256(svgBuffer),
      runtimeTextures: 0,
      svgPathDataIncludedAtRuntime: false,
    },
    extraction: {
      method: "PNG luminance ridge non-maximum suppression + structure-tensor orientation streamline tracing",
      workingDomain: "PNG luminance/ridge support",
      geometryPermission: "PNG-derived support mask only",
      svgRole: "post-seed sole and five-toe zone labels only",
    },
    freeze: {
      curveCount: APPROVED_PNG_CURVE_COUNT,
      pointCount: APPROVED_PNG_POINT_COUNT,
      curveDataSha256,
      approvedTraceSha256: APPROVED_PNG_TRACE_SHA256,
    },
    counts: {
      curves: curves.length,
      byComponent: traced.counts,
      points: totalPoints,
      segments: segmentCount,
      closedLike: closedLikeCount,
      lengthBands: { short: shortCount, medium: mediumCount, long: longCount },
    },
    focus: makeApprovedCurveFocus(runtimeCurves),
    curves: runtimeCurves,
  };
  const frozenGeometryBuffer = Buffer.from(`${JSON.stringify(frozenGeometry)}\n`);
  const report = {
    schemaVersion: 1,
    mode: "offline PNG-authoritative static comparison",
    sourceFiles: {
      guide: "scripts/strand-geometry-proof/source/option-2-guide.png",
      guideSha256: sha256(guideBuffer),
      anatomyZones: "scripts/strand-geometry-proof/source/locked-anatomy.svg",
      anatomyZonesSha256: sha256(svgBuffer),
    },
    generation: {
      workingDomain: "PNG luminance/ridge support",
      orientation: "PNG structure-tensor tangent field",
      seeds: "PNG ridge response only",
      geometryPermission: "PNG-derived support mask only",
      svgRole: "post-seed sole and five-toe zone labels only",
      svgClipping: false,
      svgBoundarySeeds: false,
      svgDrivenCurveParameters: false,
      manualToeReshaping: false,
      runtimeRenderingPerformed: false,
      alignmentForLabels: Object.fromEntries(Object.entries(alignment).map(([key, value]) => [key, Number(value.toFixed(6))])),
    },
    domain: {
      dimensions: [WIDTH, HEIGHT],
      thresholds: domain.thresholds,
      corePixels: domain.corePixelCount,
      permittedPixels: domain.allowedPixelCount,
      permittedCoverage: Number((domain.allowedPixelCount / (WIDTH * HEIGHT)).toFixed(6)),
      maximumSupport: Number(domain.maximumSupport.toFixed(6)),
      ridgeSeedThreshold: Number(traced.ridgeThreshold.toFixed(6)),
      maximumRidgeResponse: Number(traced.maximumRidge.toFixed(6)),
    },
    counts: {
      curves: curves.length,
      byZoneLabel: traced.counts,
      candidates: traced.candidateCounts,
      points: totalPoints,
      segments: segmentCount,
      closedLike: closedLikeCount,
    },
    comparison: {
      layout: "reference left, extracted geometry right",
      panelDimensions: [WIDTH, HEIGHT],
      equalScale: true,
      outputDimensions: [comparison.width, HEIGHT],
    },
    validation: {
      pngAuthoritativeDomain: true,
      svgUsedForLabelsOnly: true,
      runtimeRenderingSkipped: true,
      minimumStaticCurveCount: curves.length >= 700,
      allSixAnatomyLabelsPresent: COMPONENT_IDS.every((id) => traced.counts[id] > 0),
      noSealedLoops: closedLikeCount === 0,
      finiteCoordinates,
      normalizedCoordinates,
      approvedCurveCountLocked: curves.length === APPROVED_PNG_CURVE_COUNT,
      approvedPointCountLocked: totalPoints === APPROVED_PNG_POINT_COUNT,
      approvedTraceHashLocked: traceSha256 === APPROVED_PNG_TRACE_SHA256,
    },
  };
  if (Object.values(report.validation).some((value) => !value)) {
    throw new Error(`PNG-authoritative comparison validation failed:\n${JSON.stringify({ counts: report.counts, validation: report.validation }, null, 2)}`);
  }
  await Promise.all([
    mkdir(pngComparisonDirectory, { recursive: true }),
    freezeApprovedRuntime ? mkdir(outputDirectory, { recursive: true }) : Promise.resolve(),
  ]);
  const outputs = new Map([
    [path.join(pngComparisonDirectory, "comparison-report.json"), Buffer.from(`${JSON.stringify(report, null, 2)}\n`)],
    [path.join(pngComparisonDirectory, "static-comparison.png"), encodePng(comparison.width, HEIGHT, comparison.image, 3)],
    [path.join(pngComparisonDirectory, "png-authoritative-trace.png"), traceBuffer],
    [path.join(pngComparisonDirectory, "png-trace-overlay.png"), encodePng(WIDTH, HEIGHT, pngTraceOverlay(rgb, trace), 3)],
    [path.join(pngComparisonDirectory, "png-generation-domain.png"), encodePng(WIDTH, HEIGHT, pngDomainPreview(fields, domain), 3)],
    [path.join(pngComparisonDirectory, "png-orientation-ridges.png"), encodePng(WIDTH, HEIGHT, ridgePreview(fields))],
  ]);
  if (freezeApprovedRuntime) outputs.set(geometryPath, frozenGeometryBuffer);
  const mismatches = [];
  for (const [target, contents] of outputs) {
    if (verifyOnly) {
      try {
        const existing = await readFile(target);
        if (!existing.equals(contents)) mismatches.push(`${path.relative(workspaceRoot, target)}: stale`);
      } catch {
        mismatches.push(`${path.relative(workspaceRoot, target)}: missing`);
      }
    } else {
      await writeFile(target, contents);
    }
  }
  if (mismatches.length) throw new Error(`PNG-authoritative comparison outputs are stale:\n${mismatches.join("\n")}`);
  process.stdout.write(`${JSON.stringify({ mode: verifyOnly ? "verified" : freezeApprovedRuntime ? "frozen" : "generated", frozenGeometry: freezeApprovedRuntime ? { path: path.relative(workspaceRoot, geometryPath), bytes: frozenGeometryBuffer.length, curveDataSha256 } : null, report }, null, 2)}\n`);
}

if (!pngComparisonOnly) {
const traced = traceCurves(fields, maskData, rgb);
const curves = traced.curves;
const runtimeCurves = stripSourcePoints(curves);
const totalPoints = runtimeCurves.reduce((sum, curve) => sum + curve.points.length / 2, 0);
const segmentCount = runtimeCurves.reduce((sum, curve) => sum + curve.points.length / 2 - 1, 0);
const closedLikeCount = curves.filter((curve) => {
  const first = curve.sourcePoints[0];
  const last = curve.sourcePoints[curve.sourcePoints.length - 1];
  return vectorLength(first.x - last.x, first.y - last.y) < 4;
}).length;
const shortCount = runtimeCurves.filter((curve) => curve.length < 0.02).length;
const mediumCount = runtimeCurves.filter((curve) => curve.length >= 0.02 && curve.length < 0.09).length;
const longCount = runtimeCurves.filter((curve) => curve.length >= 0.09).length;
const geometry = {
  schemaVersion: 1,
  coordinateSystem: { width: WIDTH, height: HEIGHT, normalized: true, yUp: true },
  sources: {
    artisticGuideSha256: sha256(guideBuffer),
    anatomyMaskSha256: sha256(svgBuffer),
    runtimeTextures: 0,
    svgPathDataIncludedAtRuntime: false,
  },
  extraction: {
    method: "luminance ridge non-maximum suppression + structure-tensor orientation streamline tracing",
    alignment: Object.fromEntries(Object.entries(alignment).map(([key, value]) => [key, Number(value.toFixed(6))])),
    targetCounts: TARGET_COUNTS,
    candidateCounts: traced.candidateCounts,
  },
  counts: {
    curves: runtimeCurves.length,
    byComponent: traced.counts,
    points: totalPoints,
    segments: segmentCount,
    closedLike: closedLikeCount,
    lengthBands: { short: shortCount, medium: mediumCount, long: longCount },
  },
  focus: makeFocus(maskData),
  curves: runtimeCurves,
};
const geometryBuffer = Buffer.from(`${JSON.stringify(geometry)}\n`);
const report = {
  schemaVersion: 1,
  generatedAsset: "src/pages/dev/strand-proof/generated/strand-geometry.json",
  sourceFiles: {
    guide: "scripts/strand-geometry-proof/source/option-2-guide.png",
    guideSha256: sha256(guideBuffer),
    anatomy: "scripts/strand-geometry-proof/source/locked-anatomy.svg",
    anatomySha256: sha256(svgBuffer),
  },
  ...geometry.extraction,
  counts: geometry.counts,
  validation: {
    minimumCurveCount: runtimeCurves.length >= 420,
    fiveReadableToeGroups: COMPONENT_IDS.slice(1).every((id) => traced.counts[id] >= 18),
    wakePresent: traced.counts.wake >= 80,
    noSealedLoops: closedLikeCount === 0,
    variedLengths: shortCount > 20 && mediumCount > 40 && longCount > 15,
    finiteCoordinates: runtimeCurves.every((curve) => curve.points.every(Number.isFinite)),
    normalizedCoordinates: runtimeCurves.every((curve) => curve.points.every((value) => value >= -0.02 && value <= 1.02)),
  },
};
if (Object.values(report.validation).some((value) => !value)) throw new Error(`Strand proof validation failed:\n${JSON.stringify({ counts: report.counts, candidates: report.candidateCounts, validation: report.validation }, null, 2)}`);

await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(reportDirectory, { recursive: true })]);
const outputs = new Map([
  [geometryPath, geometryBuffer],
  [path.join(reportDirectory, "extraction-report.json"), Buffer.from(`${JSON.stringify(report, null, 2)}\n`)],
  [path.join(reportDirectory, "alignment-preview.png"), encodePng(WIDTH, HEIGHT, alignmentPreview(fields, maskData), 3)],
  [path.join(reportDirectory, "ridge-response.png"), encodePng(WIDTH, HEIGHT, ridgePreview(fields))],
  [path.join(reportDirectory, "offline-trace-preview.png"), encodePng(WIDTH, HEIGHT, tracePreview(curves), 3)],
]);
const mismatches = [];
for (const [target, contents] of outputs) {
  if (verifyOnly) {
    try {
      const existing = await readFile(target);
      if (!existing.equals(contents)) mismatches.push(`${path.relative(workspaceRoot, target)}: stale`);
    } catch {
      mismatches.push(`${path.relative(workspaceRoot, target)}: missing`);
    }
  } else {
    await writeFile(target, contents);
  }
}
if (mismatches.length) throw new Error(`Strand proof outputs are stale:\n${mismatches.join("\n")}`);
process.stdout.write(`${JSON.stringify({ mode: verifyOnly ? "verified" : "generated", ...report }, null, 2)}\n`);
}
