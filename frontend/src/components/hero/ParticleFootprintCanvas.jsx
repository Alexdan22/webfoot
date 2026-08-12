import { useEffect, useRef } from "react";
import FootprintFallback from "@/components/hero/FootprintFallback";
import {
  WEBFOOT_SOLE_PATH,
  WEBFOOT_TOES,
  WEBFOOT_VIEWBOX_SIZE,
} from "@/components/hero/webfootFootprintGeometry";

const TAU = Math.PI * 2;
const MASK_SCALE = 6;
const MASK_SIZE = WEBFOOT_VIEWBOX_SIZE * MASK_SCALE;
const SQRT_TWO = Math.SQRT2;

const CONFIGS = {
  desktop: {
    particleCount: 920,
    fieldCount: 56,
    connectionCount: 220,
    maxConnectionDistance: 5.6,
    minConnectionDistance: 0.72,
    introStart: 120,
    introDuration: 2150,
    introStagger: 840,
    nodeStart: 1120,
    nodeGap: 275,
    nodeCount: 5,
    ambient: 0.15,
    pointScale: 1,
    maxDpr: 1.5,
    showLabels: true,
    interactive: true,
    volumeHalfDepth: 2.45,
    deformRadius: 11.8,
    foldDepth: 4.1,
    spring: 96,
    damping: 18.5,
  },
  tablet: {
    particleCount: 460,
    fieldCount: 22,
    connectionCount: 96,
    maxConnectionDistance: 5.8,
    minConnectionDistance: 0.76,
    introStart: 220,
    introDuration: 2300,
    introStagger: 800,
    nodeStart: 1450,
    nodeGap: 310,
    nodeCount: 4,
    ambient: 0.1,
    pointScale: 0.94,
    maxDpr: 1.25,
    showLabels: true,
    interactive: false,
    volumeHalfDepth: 2.05,
  },
  mobile: {
    particleCount: 165,
    fieldCount: 0,
    connectionCount: 30,
    maxConnectionDistance: 6.4,
    minConnectionDistance: 0.84,
    introStart: 360,
    introDuration: 2500,
    introStagger: 660,
    nodeStart: 2050,
    nodeGap: 340,
    nodeCount: 3,
    ambient: 0.055,
    pointScale: 0.84,
    maxDpr: 1,
    showLabels: false,
    interactive: false,
    volumeHalfDepth: 1.65,
  },
};

const SERVICE_NODES = [
  { anchorX: 47.5, anchorY: 10.5, x: 0.73, y: 0.16, label: "WEBSITES", side: 1 },
  { anchorX: 48, anchorY: 29.5, x: 0.87, y: 0.42, label: "SEARCH", side: 1 },
  { anchorX: 39.5, anchorY: 46, x: 0.84, y: 0.68, label: "COMMERCE", side: 1 },
  { anchorX: 20, anchorY: 39, x: 0.22, y: 0.68, label: "AUTOMATION", side: -1 },
  { anchorX: 29.5, anchorY: 57, x: 0.48, y: 0.87, label: "ANALYTICS", side: -1 },
];

const PARTICLE_COLORS = [
  [42, 203, 255],
  [50, 142, 255],
  [132, 105, 255],
  [210, 245, 255],
];

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function getMode() {
  if (window.matchMedia("(max-width: 639px)").matches) return "mobile";
  if (
    window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches
  ) {
    return "desktop";
  }
  return "tablet";
}

function createFootprintMask() {
  if (typeof Path2D !== "function") return null;

  try {
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = MASK_SIZE;
    maskCanvas.height = MASK_SIZE;
    const maskContext = maskCanvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
    });
    if (!maskContext) return null;

    maskContext.scale(MASK_SCALE, MASK_SCALE);
    maskContext.fillStyle = "#fff";
    maskContext.fill(new Path2D(WEBFOOT_SOLE_PATH));

    for (const toe of WEBFOOT_TOES) {
      maskContext.beginPath();
      maskContext.ellipse(
        toe.cx,
        toe.cy,
        toe.rx,
        toe.ry,
        (toe.rotation * Math.PI) / 180,
        0,
        TAU,
      );
      maskContext.fill();
    }

    maskContext.setTransform(1, 0, 0, 1, 0, 0);
    const pixels = maskContext.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    const inside = new Uint8Array(MASK_SIZE * MASK_SIZE);
    const distance = new Float32Array(MASK_SIZE * MASK_SIZE);
    const insidePixels = [];
    const edgePixels = [];

    for (let index = 0; index < inside.length; index += 1) {
      const isInside = pixels[index * 4 + 3] >= 96;
      inside[index] = isInside ? 1 : 0;
      distance[index] = isInside ? 1e6 : 0;
    }

    for (let y = 0; y < MASK_SIZE; y += 1) {
      for (let x = 0; x < MASK_SIZE; x += 1) {
        const index = y * MASK_SIZE + x;
        if (!inside[index]) continue;

        let nearest = distance[index];
        if (x > 0) nearest = Math.min(nearest, distance[index - 1] + 1);
        if (y > 0) nearest = Math.min(nearest, distance[index - MASK_SIZE] + 1);
        if (x > 0 && y > 0) {
          nearest = Math.min(nearest, distance[index - MASK_SIZE - 1] + SQRT_TWO);
        }
        if (x < MASK_SIZE - 1 && y > 0) {
          nearest = Math.min(nearest, distance[index - MASK_SIZE + 1] + SQRT_TWO);
        }
        distance[index] = nearest;
      }
    }

    for (let y = MASK_SIZE - 1; y >= 0; y -= 1) {
      for (let x = MASK_SIZE - 1; x >= 0; x -= 1) {
        const index = y * MASK_SIZE + x;
        if (!inside[index]) continue;

        let nearest = distance[index];
        if (x < MASK_SIZE - 1) nearest = Math.min(nearest, distance[index + 1] + 1);
        if (y < MASK_SIZE - 1) {
          nearest = Math.min(nearest, distance[index + MASK_SIZE] + 1);
        }
        if (x < MASK_SIZE - 1 && y < MASK_SIZE - 1) {
          nearest = Math.min(nearest, distance[index + MASK_SIZE + 1] + SQRT_TWO);
        }
        if (x > 0 && y < MASK_SIZE - 1) {
          nearest = Math.min(nearest, distance[index + MASK_SIZE - 1] + SQRT_TWO);
        }
        distance[index] = nearest;
      }
    }

    for (let index = 0; index < inside.length; index += 1) {
      if (!inside[index]) continue;
      insidePixels.push(index);
      if (distance[index] <= MASK_SCALE * 1.6) edgePixels.push(index);
    }

    if (!insidePixels.length || !edgePixels.length) return null;

    return {
      inside,
      distance,
      insidePixels: Uint32Array.from(insidePixels),
      edgePixels: Uint32Array.from(edgePixels),
    };
  } catch {
    return null;
  }
}

function sampleMaskPoint(mask, random, preferEdge) {
  const pool = preferEdge ? mask.edgePixels : mask.insidePixels;
  let fallbackIndex = pool[Math.floor(random() * pool.length)];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const index = pool[Math.floor(random() * pool.length)];
    fallbackIndex = index;
    const pixelX = index % MASK_SIZE;
    const pixelY = Math.floor(index / MASK_SIZE);
    const x = (pixelX + random()) / MASK_SCALE;
    const y = (pixelY + random()) / MASK_SCALE;
    const testX = clamp(Math.floor(x * MASK_SCALE), 0, MASK_SIZE - 1);
    const testY = clamp(Math.floor(y * MASK_SCALE), 0, MASK_SIZE - 1);
    const testIndex = testY * MASK_SIZE + testX;

    if (mask.inside[testIndex]) {
      return {
        x,
        y,
        edgeDistance: mask.distance[testIndex] / MASK_SCALE,
      };
    }
  }

  return {
    x: ((fallbackIndex % MASK_SIZE) + 0.5) / MASK_SCALE,
    y: (Math.floor(fallbackIndex / MASK_SIZE) + 0.5) / MASK_SCALE,
    edgeDistance: mask.distance[fallbackIndex] / MASK_SCALE,
  };
}

function createScatterPoint(random) {
  const fromEdge = random() > 0.72;
  let u = 0.05 + random() * 0.9;
  let v = 0.06 + random() * 0.88;

  if (fromEdge) {
    const edge = Math.floor(random() * 4);
    if (edge === 0) u = -0.04 - random() * 0.08;
    if (edge === 1) u = 1.04 + random() * 0.08;
    if (edge === 2) v = -0.04 - random() * 0.08;
    if (edge === 3) v = 1.04 + random() * 0.08;
  }

  return { u, v };
}

function spatialKey(x, y, z) {
  return `${x}|${y}|${z}`;
}

function buildConnections(scene, config) {
  const cellSize = config.maxConnectionDistance;
  const cells = new Map();

  for (let index = 0; index < scene.count; index += 1) {
    const cellX = Math.floor(scene.restX[index] / cellSize);
    const cellY = Math.floor(scene.restY[index] / cellSize);
    const cellZ = Math.floor(scene.restZ[index] / cellSize);
    const key = spatialKey(cellX, cellY, cellZ);
    const cell = cells.get(key);
    if (cell) cell.push(index);
    else cells.set(key, [index]);
  }

  const connections = [];
  const usedPairs = new Set();
  const maximumDistanceSquared = config.maxConnectionDistance ** 2;
  const minimumDistanceSquared = config.minConnectionDistance ** 2;

  for (let pass = 0; pass < 3 && connections.length < config.connectionCount; pass += 1) {
    for (let index = pass; index < scene.count; index += 3) {
      const cellX = Math.floor(scene.restX[index] / cellSize);
      const cellY = Math.floor(scene.restY[index] / cellSize);
      const cellZ = Math.floor(scene.restZ[index] / cellSize);
      let nearest = -1;
      let nearestDistanceSquared = maximumDistanceSquared;

      for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const candidates = cells.get(
              spatialKey(cellX + offsetX, cellY + offsetY, cellZ + offsetZ),
            );
            if (!candidates) continue;

            for (const candidate of candidates) {
              if (candidate === index) continue;
              const low = Math.min(index, candidate);
              const high = Math.max(index, candidate);
              if (usedPairs.has(`${low}:${high}`)) continue;

              const dx = scene.restX[index] - scene.restX[candidate];
              const dy = scene.restY[index] - scene.restY[candidate];
              const dz = (scene.restZ[index] - scene.restZ[candidate]) * 0.72;
              const distanceSquared = dx * dx + dy * dy + dz * dz;
              if (
                distanceSquared > minimumDistanceSquared &&
                distanceSquared < nearestDistanceSquared
              ) {
                nearest = candidate;
                nearestDistanceSquared = distanceSquared;
              }
            }
          }
        }
      }

      if (nearest >= 0) {
        const low = Math.min(index, nearest);
        const high = Math.max(index, nearest);
        usedPairs.add(`${low}:${high}`);
        connections.push([index, nearest]);
        if (connections.length >= config.connectionCount) break;
      }
    }
  }

  return connections;
}

function makeColorIndex(random) {
  const value = random();
  if (value > 0.965) return 3;
  if (value > 0.88) return 2;
  if (value > 0.67) return 1;
  return 0;
}

function buildScene(mask, mode, config) {
  const random = createRandom(0x2f6a91 + config.particleCount * 97);
  const count = config.particleCount;
  const scene = {
    mode,
    count,
    restX: new Float32Array(count),
    restY: new Float32Array(count),
    restZ: new Float32Array(count),
    currentX: new Float32Array(count),
    currentY: new Float32Array(count),
    currentZ: new Float32Array(count),
    velocityX: new Float32Array(count),
    velocityY: new Float32Array(count),
    velocityZ: new Float32Array(count),
    projectedX: new Float32Array(count),
    projectedY: new Float32Array(count),
    projectedZ: new Float32Array(count),
    projectedScale: new Float32Array(count),
    displayX: new Float32Array(count),
    displayY: new Float32Array(count),
    displayProgress: new Float32Array(count),
    startU: new Float32Array(count),
    startV: new Float32Array(count),
    phase: new Float32Array(count),
    delay: new Float32Array(count),
    size: new Float32Array(count),
    alpha: new Float32Array(count),
    colorIndex: new Uint8Array(count),
    glow: new Uint8Array(count),
    renderOrder: Array.from({ length: count }, (_, index) => index),
    connections: [],
    field: [],
    sortTick: 0,
    needsPhysics: false,
  };

  for (let index = 0; index < count; index += 1) {
    const sample = sampleMaskPoint(mask, random, random() < 0.36);
    const edgeDepth = smoothstep(0.15, 3.8, sample.edgeDistance);
    const halfDepth = 0.58 + (config.volumeHalfDepth - 0.58) * edgeDepth;
    const depthSeed = random();
    let z;

    if (index % 3 === 0) {
      z = halfDepth * (0.74 + depthSeed * 0.26);
    } else if (index % 3 === 1) {
      z = -halfDepth * (0.74 + depthSeed * 0.26);
    } else {
      z = (depthSeed * 2 - 1) * halfDepth * 0.82;
    }

    const x = sample.x - WEBFOOT_VIEWBOX_SIZE / 2;
    const y = sample.y - WEBFOOT_VIEWBOX_SIZE / 2;
    const scatter = createScatterPoint(random);

    scene.restX[index] = x;
    scene.restY[index] = y;
    scene.restZ[index] = z;
    scene.currentX[index] = x;
    scene.currentY[index] = y;
    scene.currentZ[index] = z;
    scene.startU[index] = scatter.u;
    scene.startV[index] = scatter.v;
    scene.phase[index] = random() * TAU;
    scene.delay[index] = random() * config.introStagger;
    scene.size[index] = 0.55 + random() * 1.15;
    scene.alpha[index] = 0.48 + random() * 0.5;
    scene.colorIndex[index] = makeColorIndex(random);
    scene.glow[index] = random() > (mode === "desktop" ? 0.84 : 0.91) ? 1 : 0;
  }

  scene.renderOrder.sort((a, b) => scene.restZ[a] - scene.restZ[b]);
  scene.connections = buildConnections(scene, config);

  for (let index = 0; index < config.fieldCount; index += 1) {
    scene.field.push({
      u: 0.015 + random() * 0.62,
      v: 0.12 + random() * 0.76,
      depth: 0.2 + random() * 0.8,
      phase: random() * TAU,
      size: 0.35 + random() * 0.8,
      alpha: 0.1 + random() * 0.3,
      colorIndex: makeColorIndex(random),
    });
  }

  return scene;
}

function makeLayout(width, height, mode) {
  const scale = Math.min(
    (width * (mode === "desktop" ? 0.91 : 0.94)) / WEBFOOT_VIEWBOX_SIZE,
    (height * (mode === "mobile" ? 0.92 : 0.94)) / WEBFOOT_VIEWBOX_SIZE,
  );

  return {
    width,
    height,
    scale,
    centerX: width * (mode === "desktop" ? 0.56 : 0.51),
    centerY: height * (mode === "mobile" ? 0.51 : 0.5),
  };
}

function getRotation(pointer, layout, elapsed) {
  const horizontal = clamp(pointer.x / layout.width, 0, 1) - 0.5;
  const vertical = clamp(pointer.y / layout.height, 0, 1) - 0.5;
  const response = pointer.active;

  return {
    x: -0.075 - vertical * 0.07 * response,
    y: 0.12 + horizontal * 0.09 * response,
    z: -0.035 + Math.sin(elapsed * 0.00011) * 0.006,
  };
}

function projectPoint(x, y, z, layout, rotation) {
  const cosineZ = Math.cos(rotation.z);
  const sineZ = Math.sin(rotation.z);
  const cosineY = Math.cos(rotation.y);
  const sineY = Math.sin(rotation.y);
  const cosineX = Math.cos(rotation.x);
  const sineX = Math.sin(rotation.x);
  const rotatedX = x * cosineZ - y * sineZ;
  const rotatedY = x * sineZ + y * cosineZ;
  const tiltedX = rotatedX * cosineY + z * sineY;
  const tiltedZ = -rotatedX * sineY + z * cosineY;
  const tiltedY = rotatedY * cosineX - tiltedZ * sineX;
  const depth = rotatedY * sineX + tiltedZ * cosineX;
  const perspective = clamp(118 / (118 - depth), 0.86, 1.16);

  return {
    x: layout.centerX + tiltedX * layout.scale * perspective,
    y: layout.centerY + tiltedY * layout.scale * perspective,
    z: depth,
    scale: perspective,
  };
}

function updatePointer(pointer, deltaSeconds) {
  const positionFollow = 1 - Math.exp(-deltaSeconds * 12);
  const responseFollow = 1 - Math.exp(-deltaSeconds * 9);
  pointer.x += (pointer.targetX - pointer.x) * positionFollow;
  pointer.y += (pointer.targetY - pointer.y) * positionFollow;
  pointer.active += (pointer.targetActive - pointer.active) * responseFollow;
  pointer.motionX += (pointer.targetMotionX - pointer.motionX) * responseFollow;
  pointer.motionY += (pointer.targetMotionY - pointer.motionY) * responseFollow;
  const motionDecay = Math.exp(-deltaSeconds * 7.5);
  pointer.targetMotionX *= motionDecay;
  pointer.targetMotionY *= motionDecay;
}

function updatePhysics(scene, config, pointer, layout, deltaSeconds) {
  if (!config.interactive || deltaSeconds <= 0) return;
  if (pointer.active > 0.001) scene.needsPhysics = true;
  if (!scene.needsPhysics) return;

  const localPointerX = (pointer.x - layout.centerX) / layout.scale;
  const localPointerY = (pointer.y - layout.centerY) / layout.scale;
  const radius = config.deformRadius;
  const motionMagnitude = clamp(Math.hypot(pointer.motionX, pointer.motionY));
  const directionX = motionMagnitude > 0.025 ? pointer.motionX / motionMagnitude : 1;
  const directionY = motionMagnitude > 0.025 ? pointer.motionY / motionMagnitude : 0;
  let maximumEnergy = 0;

  for (let index = 0; index < scene.count; index += 1) {
    const restX = scene.restX[index];
    const restY = scene.restY[index];
    const restZ = scene.restZ[index];
    let targetX = restX;
    let targetY = restY;
    let targetZ = restZ;

    if (pointer.active > 0.001) {
      const dx = restX - localPointerX;
      const dy = restY - localPointerY;
      const distance = Math.hypot(dx, dy);

      if (distance < radius) {
        const unitDistance = distance / radius;
        const influence = (1 - smoothstep(0, 1, unitDistance)) * pointer.active;
        const fallbackAngle = scene.phase[index];
        const normalX = distance > 0.01 ? dx / distance : Math.cos(fallbackAngle);
        const normalY = distance > 0.01 ? dy / distance : Math.sin(fallbackAngle);
        const rim = Math.exp(-Math.pow((unitDistance - 0.67) / 0.18, 2));
        const outward = influence * 2.35 + rim * pointer.active * 0.72;
        const creaseSide = clamp(
          (dx * -directionY + dy * directionX) / (radius * 0.62),
          -1,
          1,
        );
        const fold =
          creaseSide *
          influence *
          motionMagnitude *
          config.foldDepth;

        targetX += normalX * outward + pointer.motionX * influence * 0.75;
        targetY += normalY * outward + pointer.motionY * influence * 0.75;
        targetZ += -influence * 3.05 + rim * pointer.active * 2.15 + fold;
      }
    }

    const accelerationX =
      config.spring * (targetX - scene.currentX[index]) -
      config.damping * scene.velocityX[index];
    const accelerationY =
      config.spring * (targetY - scene.currentY[index]) -
      config.damping * scene.velocityY[index];
    const accelerationZ =
      config.spring * (targetZ - scene.currentZ[index]) -
      config.damping * scene.velocityZ[index];

    scene.velocityX[index] += accelerationX * deltaSeconds;
    scene.velocityY[index] += accelerationY * deltaSeconds;
    scene.velocityZ[index] += accelerationZ * deltaSeconds;
    scene.currentX[index] += scene.velocityX[index] * deltaSeconds;
    scene.currentY[index] += scene.velocityY[index] * deltaSeconds;
    scene.currentZ[index] += scene.velocityZ[index] * deltaSeconds;

    const displacement =
      Math.abs(scene.currentX[index] - restX) +
      Math.abs(scene.currentY[index] - restY) +
      Math.abs(scene.currentZ[index] - restZ);
    const velocity =
      Math.abs(scene.velocityX[index]) +
      Math.abs(scene.velocityY[index]) +
      Math.abs(scene.velocityZ[index]);
    maximumEnergy = Math.max(maximumEnergy, displacement + velocity * 0.08);
  }

  if (pointer.active < 0.001 && maximumEnergy < 0.003) {
    scene.currentX.set(scene.restX);
    scene.currentY.set(scene.restY);
    scene.currentZ.set(scene.restZ);
    scene.velocityX.fill(0);
    scene.velocityY.fill(0);
    scene.velocityZ.fill(0);
    scene.needsPhysics = false;
  }
}

function projectScene(scene, config, layout, rotation, elapsed) {
  const cosineZ = Math.cos(rotation.z);
  const sineZ = Math.sin(rotation.z);
  const cosineY = Math.cos(rotation.y);
  const sineY = Math.sin(rotation.y);
  const cosineX = Math.cos(rotation.x);
  const sineX = Math.sin(rotation.x);
  const settled = easeOutCubic(
    clamp((elapsed - config.introStart - config.introDuration * 0.58) / 1100),
  );

  for (let index = 0; index < scene.count; index += 1) {
    const phase = scene.phase[index];
    const depthWeight =
      0.5 + Math.abs(scene.currentZ[index]) / (config.volumeHalfDepth * 2);
    const x =
      scene.currentX[index] +
      Math.sin(elapsed * 0.00039 + phase) * config.ambient * depthWeight * settled;
    const y =
      scene.currentY[index] +
      Math.cos(elapsed * 0.00031 + phase * 1.23) *
        config.ambient *
        depthWeight *
        settled;
    const z =
      scene.currentZ[index] +
      Math.sin(elapsed * 0.00028 + phase * 0.81) * config.ambient * 0.72 * settled;
    const rotatedX = x * cosineZ - y * sineZ;
    const rotatedY = x * sineZ + y * cosineZ;
    const tiltedX = rotatedX * cosineY + z * sineY;
    const tiltedZ = -rotatedX * sineY + z * cosineY;
    const tiltedY = rotatedY * cosineX - tiltedZ * sineX;
    const depth = rotatedY * sineX + tiltedZ * cosineX;
    const perspective = clamp(118 / (118 - depth), 0.86, 1.16);
    const progress = easeOutCubic(
      clamp(
        (elapsed - config.introStart - scene.delay[index]) /
          config.introDuration,
      ),
    );
    const targetX = layout.centerX + tiltedX * layout.scale * perspective;
    const targetY = layout.centerY + tiltedY * layout.scale * perspective;
    const startX = scene.startU[index] * layout.width;
    const startY = scene.startV[index] * layout.height;

    scene.projectedX[index] = targetX;
    scene.projectedY[index] = targetY;
    scene.projectedZ[index] = depth;
    scene.projectedScale[index] = perspective;
    scene.displayX[index] = startX + (targetX - startX) * progress;
    scene.displayY[index] = startY + (targetY - startY) * progress;
    scene.displayProgress[index] = progress;
  }

  scene.sortTick += 1;
  const sortInterval = scene.needsPhysics ? 4 : 14;
  if (scene.sortTick >= sortInterval) {
    scene.renderOrder.sort(
      (first, second) => scene.projectedZ[first] - scene.projectedZ[second],
    );
    scene.sortTick = 0;
  }
}

function drawFieldParticles(ctx, scene, layout, pointer, elapsed, reveal) {
  if (!scene.field.length || reveal <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of scene.field) {
    const [red, green, blue] = PARTICLE_COLORS[particle.colorIndex];
    const driftX = Math.sin(elapsed * 0.00023 + particle.phase) * 4.5 * particle.depth;
    const driftY = Math.cos(elapsed * 0.00019 + particle.phase) * 3 * particle.depth;
    const parallaxX =
      ((pointer.x / layout.width - 0.5) * 2) * particle.depth * pointer.active * 3.5;
    const parallaxY =
      ((pointer.y / layout.height - 0.5) * 2) * particle.depth * pointer.active * 2.5;
    ctx.globalAlpha = reveal * particle.alpha;
    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
    ctx.beginPath();
    ctx.arc(
      particle.u * layout.width + driftX + parallaxX,
      particle.v * layout.height + driftY + parallaxY,
      particle.size,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawConnections(ctx, scene, config, lineReveal) {
  if (lineReveal <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(61, 153, 255, ${0.26 * lineReveal})`;
  ctx.lineWidth = config.showLabels ? 0.72 : 0.55;
  ctx.beginPath();
  for (const [fromIndex, toIndex] of scene.connections) {
    const reveal = Math.min(
      scene.displayProgress[fromIndex],
      scene.displayProgress[toIndex],
    );
    if (reveal < 0.32) continue;
    ctx.moveTo(scene.displayX[fromIndex], scene.displayY[fromIndex]);
    ctx.lineTo(scene.displayX[toIndex], scene.displayY[toIndex]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, scene, config, reveal) {
  if (reveal <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const index of scene.renderOrder) {
    const progress = scene.displayProgress[index];
    const depth = clamp((scene.projectedZ[index] + 9) / 18);
    const [red, green, blue] = PARTICLE_COLORS[scene.colorIndex[index]];
    const radius =
      scene.size[index] *
      config.pointScale *
      scene.projectedScale[index] *
      (0.78 + depth * 0.38);
    ctx.globalAlpha =
      reveal *
      scene.alpha[index] *
      (0.2 + progress * 0.8) *
      (0.62 + depth * 0.38);
    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;

    if (scene.glow[index]) {
      ctx.shadowColor = `rgba(${red}, ${green}, ${blue}, 0.7)`;
      ctx.shadowBlur = config.showLabels ? 8 : 4;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(scene.displayX[index], scene.displayY[index], radius, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawServiceNode(
  ctx,
  node,
  index,
  elapsed,
  layout,
  config,
  rotation,
) {
  if (index >= config.nodeCount) return;

  const activation = easeOutCubic(
    clamp((elapsed - config.nodeStart - index * config.nodeGap) / 520),
  );
  if (activation <= 0) return;

  const anchor = projectPoint(
    node.anchorX - WEBFOOT_VIEWBOX_SIZE / 2,
    node.anchorY - WEBFOOT_VIEWBOX_SIZE / 2,
    0,
    layout,
    rotation,
  );
  const useExternalNode = config.showLabels;
  const x = useExternalNode ? node.x * layout.width : anchor.x;
  const y = useExternalNode ? node.y * layout.height : anchor.y;
  const pulse = 1 + Math.sin(elapsed * 0.0014 + index) * 0.035 * activation;
  const ringRadius = (useExternalNode ? 13 + activation * 7 : 5 + activation * 4) * pulse;

  ctx.save();
  ctx.globalAlpha = activation;
  if (useExternalNode) {
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = "rgba(117, 176, 255, 0.34)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.quadraticCurveTo((anchor.x + x) / 2, y - layout.height * 0.035, x, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "rgba(74, 202, 255, 0.52)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(150, 116, 255, 0.3)";
  ctx.beginPath();
  ctx.arc(x, y, ringRadius + 4, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = "rgba(181, 239, 255, 0.96)";
  ctx.shadowColor = "rgba(56, 191, 255, 0.7)";
  ctx.shadowBlur = config.showLabels ? 8 : 4;
  ctx.beginPath();
  ctx.arc(x, y, 2.15, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (useExternalNode) {
    const direction = node.side;
    const lineLength = layout.width < 520 ? 18 : 27;
    const endX = x + direction * lineLength;
    ctx.strokeStyle = "rgba(116, 184, 255, 0.32)";
    ctx.beginPath();
    ctx.moveTo(x + direction * ringRadius, y);
    ctx.lineTo(endX, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(206, 231, 247, 0.74)";
    ctx.font = '600 9px "SFMono-Regular", Consolas, monospace';
    ctx.textBaseline = "middle";
    ctx.textAlign = direction > 0 ? "left" : "right";
    ctx.fillText(node.label, endX + direction * 7, y + 0.5);
  }

  ctx.restore();
}

export default function ParticleFootprintCanvas() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    let ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    const mask = createFootprintMask();
    if (!ctx || !mask) {
      canvas.dataset.renderer = "static-fallback";
      return undefined;
    }

    let scene;
    let mode = "mobile";
    let config = CONFIGS.mobile;
    let layout = makeLayout(1, 1, mode);
    let elapsed = 0;
    let lastTime = 0;
    let frameId = 0;
    let resizeFrame = 0;
    let isIntersecting = true;
    let isDocumentVisible = !document.hidden;
    let contextAvailable = true;
    let canvasReady = false;
    const pointer = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      active: 0,
      targetActive: 0,
      motionX: 0,
      motionY: 0,
      targetMotionX: 0,
      targetMotionY: 0,
      lastEventX: 0,
      lastEventY: 0,
      lastEventTime: 0,
      initialized: false,
    };
    const finePointerQuery = window.matchMedia("(pointer: fine)");

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height || !ctx) return;

      const nextMode = getMode();
      const nextConfig = CONFIGS[nextMode];
      const logicalWidth = Math.max(1, Math.round(rect.width));
      const logicalHeight = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, nextConfig.maxDpr);
      const renderWidth = Math.max(1, Math.round(logicalWidth * dpr));
      const renderHeight = Math.max(1, Math.round(logicalHeight * dpr));

      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
      }
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      mode = nextMode;
      config = nextConfig;
      layout = makeLayout(logicalWidth, logicalHeight, mode);
      if (!scene || scene.mode !== mode) scene = buildScene(mask, mode, config);

      if (!pointer.initialized) {
        pointer.x = layout.centerX;
        pointer.y = layout.centerY;
        pointer.targetX = layout.centerX;
        pointer.targetY = layout.centerY;
        pointer.initialized = true;
      }

      canvas.dataset.particleMode = mode;
      canvas.dataset.particleCount = String(config.particleCount);
      canvas.dataset.volume = "shallow-3d";
      canvas.dataset.maxDpr = String(config.maxDpr);
    };

    const draw = () => {
      if (!scene || !ctx || !contextAvailable) return;
      ctx.clearRect(0, 0, layout.width, layout.height);

      const reveal = easeOutCubic(clamp(elapsed / 540));
      const lineReveal = easeOutCubic(
        clamp((elapsed - config.introStart - config.introDuration * 0.44) / 1250),
      );
      const rotation = getRotation(pointer, layout, elapsed);
      projectScene(scene, config, layout, rotation, elapsed);
      drawFieldParticles(ctx, scene, layout, pointer, elapsed, reveal);
      drawConnections(ctx, scene, config, lineReveal);
      drawParticles(ctx, scene, config, reveal);
      SERVICE_NODES.forEach((node, index) => {
        drawServiceNode(ctx, node, index, elapsed, layout, config, rotation);
      });

      if (!canvasReady && elapsed > 48) {
        canvasReady = true;
        canvas.classList.add("is-ready");
        container.classList.add("is-canvas-ready");
      }
    };

    const render = (time) => {
      if (!isIntersecting || !isDocumentVisible || !contextAvailable) {
        frameId = 0;
        return;
      }

      const deltaSeconds = lastTime
        ? Math.min(1 / 30, Math.max(0, (time - lastTime) / 1000))
        : 1 / 60;
      lastTime = time;
      elapsed += deltaSeconds * 1000;
      updatePointer(pointer, deltaSeconds);
      updatePhysics(scene, config, pointer, layout, deltaSeconds);
      draw();
      frameId = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (
        !frameId &&
        isIntersecting &&
        isDocumentVisible &&
        contextAvailable
      ) {
        lastTime = 0;
        frameId = window.requestAnimationFrame(render);
      }
    };

    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = 0;
    };

    const onPointerMove = (event) => {
      if (
        !config.interactive ||
        !finePointerQuery.matches ||
        !isIntersecting ||
        event.pointerType === "touch"
      ) {
        pointer.targetActive = 0;
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
      if (!inside) {
        pointer.targetActive = 0;
        return;
      }

      const now = performance.now();
      if (pointer.lastEventTime) {
        const eventDelta = Math.max(8, now - pointer.lastEventTime);
        pointer.targetMotionX = clamp(
          (x - pointer.lastEventX) / (eventDelta * 0.72),
          -1,
          1,
        );
        pointer.targetMotionY = clamp(
          (y - pointer.lastEventY) / (eventDelta * 0.72),
          -1,
          1,
        );
      }

      pointer.targetX = x;
      pointer.targetY = y;
      pointer.targetActive = 1;
      pointer.lastEventX = x;
      pointer.lastEventY = y;
      pointer.lastEventTime = now;
    };

    const releasePointer = () => {
      pointer.targetActive = 0;
      pointer.targetMotionX = 0;
      pointer.targetMotionY = 0;
      pointer.lastEventTime = 0;
    };

    const onVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible) start();
      else stop();
    };

    const onResize = () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        resize();
        draw();
      });
    };

    const onContextLost = (event) => {
      event.preventDefault();
      contextAvailable = false;
      stop();
      canvas.classList.remove("is-ready");
      container.classList.remove("is-canvas-ready");
      canvas.dataset.renderer = "static-fallback";
    };

    const onContextRestored = () => {
      ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
      if (!ctx) return;
      contextAvailable = true;
      canvasReady = false;
      scene = undefined;
      canvas.dataset.renderer = "canvas-2d";
      resize();
      draw();
      start();
    };

    const intersectionObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              isIntersecting = entry.isIntersecting;
              if (isIntersecting) start();
              else {
                releasePointer();
                stop();
              }
            },
            { rootMargin: "80px 0px", threshold: 0.01 },
          )
        : null;
    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(onResize) : null;

    canvas.dataset.renderer = "canvas-2d";
    resize();
    draw();
    intersectionObserver?.observe(container);
    resizeObserver?.observe(container);
    if (!resizeObserver) window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointercancel", releasePointer, { passive: true });
    window.addEventListener("blur", releasePointer);
    document.documentElement.addEventListener("mouseleave", releasePointer);
    canvas.addEventListener("contextlost", onContextLost);
    canvas.addEventListener("contextrestored", onContextRestored);
    finePointerQuery.addEventListener?.("change", onResize);
    start();

    return () => {
      stop();
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointercancel", releasePointer);
      window.removeEventListener("blur", releasePointer);
      document.documentElement.removeEventListener("mouseleave", releasePointer);
      canvas.removeEventListener("contextlost", onContextLost);
      canvas.removeEventListener("contextrestored", onContextRestored);
      finePointerQuery.removeEventListener?.("change", onResize);
    };
  }, []);

  return (
    <div ref={containerRef} className="particle-canvas-shell">
      <FootprintFallback className="particle-canvas-fallback" />
      <canvas
        ref={canvasRef}
        width="720"
        height="640"
        aria-hidden="true"
        role="presentation"
        data-testid="hero-particle-canvas"
        className="hero-particle-canvas"
      />
    </div>
  );
}
