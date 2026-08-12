export const strandProofVertexShader = /* glsl */ `
  attribute vec3 aPrevious;
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aWidth;
  attribute float aColour;
  attribute float aAlpha;
  attribute float aKind;
  attribute float aSeed;
  attribute float aPhase;
  attribute float aBundlePhase;
  attribute float aFlexibility;
  attribute float aDepth;
  attribute float aArcPosition;
  uniform vec2 uViewport;
  uniform float uPixelRatio;
  uniform vec2 uFocusCenter;
  uniform float uFocusScale;
  uniform float uWidthScale;
  uniform float uMinPixelWidth;
  uniform float uPassWidth;
  uniform float uDepthStrength;
  uniform float uTime;
  uniform float uMotionEnabled;
  uniform float uMotionAmplitude;
  uniform float uMotionSpeed;
  uniform float uMotionCoherence;
  uniform float uPresentationScale;
  uniform float uPresentationRotation;
  uniform vec2 uPresentationTranslation;
  uniform float uWakeupProgress;
  uniform sampler2D uCrawlCurveTexture;
  uniform float uCrawlSampleCount;
  uniform vec2 uPointerPosition;
  uniform vec2 uPointerTrailPosition;
  uniform vec2 uPointerVelocity;
  uniform float uPointerStrength;
  uniform float uPointerTrailStrength;
  uniform float uPointerRadius;
  uniform float uPointerAmplitude;
  varying float vAcross;
  varying float vAlpha;
  varying float vProgress;
  varying float vKind;
  varying float vBand;
  varying float vSeed;
  varying float vFlowPulse;
  varying float vPointerEnergy;
  varying float vPointerOutwardSide;
  varying float vCrawlSettled;
  varying float vCrawlHead;
  varying vec3 vColour;

  float decodeCrawlOrder(float packed) {
    return floor(packed * 0.5) / 1023.0;
  }

  float decodeCrawlArc(float packed) {
    float orderCode = floor(packed * 0.5);
    return packed - orderCode * 2.0;
  }

  vec2 sampleCrawlCurve(float arcPosition, float lookupY) {
    float samplePosition = clamp(arcPosition, 0.0, 1.0) * (uCrawlSampleCount - 1.0);
    float lowerIndex = floor(samplePosition);
    float upperIndex = min(uCrawlSampleCount - 1.0, lowerIndex + 1.0);
    float interpolation = fract(samplePosition);
    vec2 lowerUv = vec2((lowerIndex + 0.5) / uCrawlSampleCount, lookupY);
    vec2 upperUv = vec2((upperIndex + 0.5) / uCrawlSampleCount, lookupY);
    return mix(
      texture2D(uCrawlCurveTexture, lowerUv).xy,
      texture2D(uCrawlCurveTexture, upperUv).xy,
      interpolation
    );
  }

  float curveCrawlProgress(float activationOrder, float kind) {
    if (uWakeupProgress >= 0.9999) return 1.0;
    float wake = step(0.75, kind);
    float start = 0.075 + activationOrder * 0.6;
    float duration = mix(0.39, 0.32, wake);
    return smoothstep(start, min(0.995, start + duration), uWakeupProgress);
  }

  float crawlSettledAmount(float crawlArc, float crawlProgress) {
    if (uWakeupProgress >= 0.9999) return 1.0;
    float settlementHead = crawlProgress + smoothstep(0.78, 1.0, crawlProgress) * 0.12;
    return 1.0 - smoothstep(settlementHead - 0.075, settlementHead + 0.045, crawlArc);
  }

  float remapCrawlArc(float crawlArc, float crawlProgress) {
    if (uWakeupProgress >= 0.9999) return crawlArc;
    float settled = crawlSettledAmount(crawlArc, crawlProgress);
    float compressed = crawlProgress + max(0.0, crawlArc - crawlProgress) * 0.045;
    return mix(clamp(compressed, 0.0, 1.0), crawlArc, settled);
  }

  vec2 crawlCurvePoint(vec2 canonicalPoint, float crawlArc, float lookupY, float crawlProgress) {
    if (uWakeupProgress >= 0.9999) return canonicalPoint;
    float mappedArc = remapCrawlArc(crawlArc, crawlProgress);
    return canonicalPoint
      + sampleCrawlCurve(mappedArc, lookupY)
      - sampleCrawlCurve(crawlArc, lookupY);
  }

  float travellingGust(vec2 point, float arcPosition, float bundlePhase, float depth, float kind) {
    float wake = step(0.75, kind);
    float depthRate = mix(0.9, 1.08, depth * 0.5);
    float bundleDelay = sin(bundlePhase * 0.73) * 0.16 + cos(bundlePhase * 0.31) * 0.06;
    float narrowCarrier = point.x * 8.4
      + uTime * uMotionSpeed * depthRate * mix(1.0, 1.08, wake) * 1.46
      + arcPosition * 0.34
      + bundleDelay;
    float broadCarrier = point.x * 3.15
      + uTime * uMotionSpeed * depthRate * 0.54
      + bundlePhase * 0.075;
    float narrow = smoothstep(0.38, 0.93, sin(narrowCarrier) * 0.5 + 0.5);
    float broad = smoothstep(0.16, 0.9, sin(broadCarrier) * 0.5 + 0.5);
    float independentGust = 0.2 + narrow * 0.56 + broad * 0.24;

    float coherentDepthRate = mix(0.97, 1.03, depth * 0.5);
    float coherentDelay = sin(bundlePhase * 0.73) * 0.045 + cos(bundlePhase * 0.31) * 0.018;
    float coherentCarrier = point.x * 6.2
      + point.y * 0.72
      + uTime * uMotionSpeed * coherentDepthRate * mix(1.0, 1.03, wake) * 1.18
      + arcPosition * 0.12
      + coherentDelay;
    float coherentBroadCarrier = point.x * 2.55
      + point.y * 0.34
      + uTime * uMotionSpeed * coherentDepthRate * 0.46
      + bundlePhase * 0.022;
    float coherentNarrow = smoothstep(0.34, 0.92, sin(coherentCarrier) * 0.5 + 0.5);
    float coherentBroad = smoothstep(0.18, 0.9, sin(coherentBroadCarrier) * 0.5 + 0.5);
    float coherentGust = 0.29 + coherentNarrow * 0.45 + coherentBroad * 0.26;
    return mix(independentGust, coherentGust, uMotionCoherence);
  }

  vec4 pointerPressureSample(vec2 point, vec2 pointerPosition, float strength, float radius) {
    vec2 wind = normalize(vec2(-0.985, 0.172));
    float speed = length(uPointerVelocity);
    float speedWeight = smoothstep(0.015, 0.48, speed);
    vec2 velocityDirection = speed > 0.0001 ? normalize(uPointerVelocity) : wind;
    vec2 pressureAxis = normalize(mix(wind, velocityDirection, speedWeight) + vec2(0.00001));
    vec2 pressurePerpendicular = vec2(-pressureAxis.y, pressureAxis.x);
    vec2 delta = point - pointerPosition;
    float along = dot(delta, pressureAxis);
    float lateral = dot(delta, pressurePerpendicular);
    float safeRadius = max(radius, 0.0001);
    float forwardScale = mix(1.04, 1.22, speedWeight);
    float backwardScale = mix(1.1, 1.32, speedWeight);
    float longitudinalRadius = safeRadius * mix(backwardScale, forwardScale, step(0.0, along));
    float lateralRadius = safeRadius * mix(0.84, 0.76, speedWeight);
    float ellipseDistance = length(vec2(lateral / lateralRadius, along / longitudinalRadius));
    float influence = 1.0 - smoothstep(0.1, 1.04, ellipseDistance);
    influence = influence * influence * (3.0 - 2.0 * influence);

    vec2 radialOut = normalize(delta + pressurePerpendicular * 0.00001);
    float outwardVelocity = max(0.0, dot(pressureAxis, radialOut));
    vec2 outwardDirection = normalize(radialOut + pressureAxis * outwardVelocity * speedWeight * 0.12);
    float aheadWeight = mix(0.94, 1.08, smoothstep(-safeRadius * 0.44, safeRadius * 0.62, along));
    return vec4(outwardDirection, influence * strength * aheadWeight, ellipseDistance);
  }

  vec2 deformStrand(
    vec2 point,
    vec2 rawTangent,
    float arcPosition,
    float crawlArc,
    float lookupY,
    float activationOrder,
    float phase,
    float bundlePhase,
    float flexibility,
    float depth,
    float kind
  ) {
    if (uMotionEnabled < 0.5) return point;
    float crawlProgress = curveCrawlProgress(activationOrder, kind);
    vec2 crawledPoint = crawlCurvePoint(point, crawlArc, lookupY, crawlProgress);
    vec2 tangent = normalize(vec2(rawTangent.x, rawTangent.y * 1.5) + vec2(0.00001));
    vec2 wind = normalize(vec2(-0.985, 0.172));
    float wake = step(0.75, kind);
    float toe = step(0.25, kind) * (1.0 - step(0.75, kind));
    float independentDepthAmplitude = mix(1.08, 0.84, depth * 0.5);
    float coherentDepthAmplitude = mix(1.03, 0.95, depth * 0.5);
    float depthAmplitude = mix(independentDepthAmplitude, coherentDepthAmplitude, uMotionCoherence);
    float independentKindAmplitude = mix(0.82, 2.04, wake) * mix(1.0, 0.48, toe);
    float coherentKindAmplitude = mix(0.88, 1.84, wake) * mix(1.0, 0.54, toe);
    float kindAmplitude = mix(independentKindAmplitude, coherentKindAmplitude, uMotionCoherence);
    float centerEnvelope = smoothstep(0.0, 0.16, arcPosition)
      * (1.0 - smoothstep(0.84, 1.0, arcPosition));
    float endpointFloor = mix(0.16, 0.46, wake);
    endpointFloor = mix(endpointFloor, 0.08, toe);
    float strandEnvelope = mix(endpointFloor, 1.0, centerEnvelope);
    float gust = travellingGust(point, arcPosition, bundlePhase, depth, kind);
    float independentLift = 0.88 + 0.12 * sin(point.x * 4.2 + uTime * uMotionSpeed * 0.22 + bundlePhase * 0.11);
    float coherentLift = 0.94 + 0.06 * sin(point.x * 3.1 + point.y * 0.7 + uTime * uMotionSpeed * 0.18 + bundlePhase * 0.025);
    float lift = mix(independentLift, coherentLift, uMotionCoherence);
    float sharedFlexibility = mix(0.42, 0.82, wake);
    sharedFlexibility = mix(sharedFlexibility, 0.34, toe);
    float coherentFlexibility = mix(sharedFlexibility, flexibility, 0.22);
    float resolvedFlexibility = mix(flexibility, coherentFlexibility, uMotionCoherence);
    float crosswindLift = mix(0.075, 0.045, uMotionCoherence);
    float amplitude = uMotionAmplitude * resolvedFlexibility * depthAmplitude * kindAmplitude * strandEnvelope;
    float settledAtVertex = crawlSettledAmount(crawlArc, crawlProgress);
    float windBlend = mix(0.08, 1.0, smoothstep(0.02, 0.92, crawlProgress))
      * mix(0.32, 1.0, settledAtVertex);
    vec2 idleOffset = (wind * gust + vec2(0.0, gust * lift * crosswindLift)) * amplitude * windBlend;

    vec4 currentPressure = pointerPressureSample(point, uPointerPosition, uPointerStrength, uPointerRadius);
    vec4 trailPressure = pointerPressureSample(point, uPointerTrailPosition, uPointerTrailStrength, uPointerRadius * 0.9);
    vec2 pressureVector = currentPressure.xy * currentPressure.z + trailPressure.xy * trailPressure.z * 0.38;
    vec2 currentRadialOut = normalize(point - uPointerPosition + vec2(0.00001));
    pressureVector -= currentRadialOut * min(0.0, dot(pressureVector, currentRadialOut));
    float tangentialPressure = dot(pressureVector, tangent);
    pressureVector -= tangent * tangentialPressure * 0.62;
    pressureVector -= currentRadialOut * min(0.0, dot(pressureVector, currentRadialOut));
    float bundleResponse = 0.97 + 0.03 * sin(bundlePhase * 0.91 + phase * 0.17);
    float pointerKindResponse = mix(0.58, 1.2, wake) * mix(1.0, 0.42, toe);
    float pointerFlexibility = mix(0.7, 1.0, flexibility);
    float pointerCenterEnvelope = smoothstep(0.0, 0.16, arcPosition)
      * (1.0 - smoothstep(0.84, 1.0, arcPosition));
    float pointerEndpointFloor = mix(0.34, 0.52, wake);
    pointerEndpointFloor = mix(pointerEndpointFloor, 0.18, toe);
    float propagationEnvelope = mix(pointerEndpointFloor, 1.0, pointerCenterEnvelope);
    vec2 pointerOffset = pressureVector
      * uPointerAmplitude
      * bundleResponse
      * pointerKindResponse
      * pointerFlexibility
      * propagationEnvelope;
    float pointerClamp = uPointerAmplitude * mix(0.52, 0.96, wake) * mix(1.0, 0.42, toe);
    float pointerLength = length(pointerOffset);
    if (pointerLength > pointerClamp) pointerOffset *= pointerClamp / pointerLength;
    return crawledPoint + idleOffset + pointerOffset;
  }

  vec2 imageToClip(vec2 point, float band) {
    vec2 focused = (point - uFocusCenter) * uFocusScale + 0.5;
    float depth = band - 1.0;
    float layerScale = 1.0 + depth * uDepthStrength;
    vec2 parallax = depth * vec2(-0.0028, 0.0019) * uFocusScale;
    focused = (focused - 0.5) * layerScale + 0.5 + parallax;
    vec2 ndc = focused * 2.0 - 1.0;
    float viewportRatio = uViewport.x / max(uViewport.y, 1.0);
    float imageRatio = 2.0 / 3.0;
    vec2 fit = vec2(1.0);
    if (viewportRatio > imageRatio) {
      fit.x = imageRatio / viewportRatio;
    } else {
      fit.y = viewportRatio / imageRatio;
    }
    vec2 fitted = ndc * fit;
    float presentationCosine = cos(uPresentationRotation);
    float presentationSine = sin(uPresentationRotation);
    mat2 presentationRotation = mat2(
      presentationCosine,
      presentationSine,
      -presentationSine,
      presentationCosine
    );
    return presentationRotation * fitted * uPresentationScale + uPresentationTranslation;
  }

  void main() {
    vec2 rawTangent = aNext.xy - aPrevious.xy;
    float lookupDirection = aPrevious.z < 0.0 ? -1.0 : 1.0;
    float lookupY = abs(aPrevious.z);
    float crawlArc = decodeCrawlArc(aNext.z);
    float activationOrder = decodeCrawlOrder(aNext.z);
    float crawlProgress = curveCrawlProgress(activationOrder, aKind);
    vec2 movedPoint = deformStrand(position.xy, rawTangent, aArcPosition, crawlArc, lookupY, activationOrder, aPhase, aBundlePhase, aFlexibility, aDepth, aKind);
    vec2 movedPrevious = deformStrand(aPrevious.xy, rawTangent, max(0.0, aArcPosition - 0.018), clamp(crawlArc - lookupDirection * 0.018, 0.0, 1.0), lookupY, activationOrder, aPhase, aBundlePhase, aFlexibility, aDepth, aKind);
    vec2 movedNext = deformStrand(aNext.xy, rawTangent, min(1.0, aArcPosition + 0.018), clamp(crawlArc + lookupDirection * 0.018, 0.0, 1.0), lookupY, activationOrder, aPhase, aBundlePhase, aFlexibility, aDepth, aKind);
    vec2 clipPoint = imageToClip(movedPoint, aDepth);
    vec2 clipPrevious = imageToClip(movedPrevious, aDepth);
    vec2 clipNext = imageToClip(movedNext, aDepth);
    vec2 incoming = normalize((clipPoint - clipPrevious) * uViewport + vec2(0.00001));
    vec2 outgoing = normalize((clipNext - clipPoint) * uViewport + vec2(0.00001));
    vec2 direction = normalize(incoming + outgoing + vec2(0.00001));
    vec2 perpendicular = vec2(-direction.y, direction.x);
    vec2 outgoingPerpendicular = vec2(-outgoing.y, outgoing.x);
    float miter = clamp(1.0 / max(0.72, dot(perpendicular, outgoingPerpendicular)), 1.0, 1.36);
    float wake = step(0.75, aKind);
    float depthWidth = mix(0.94, 1.04, aDepth * 0.5);
    float kindWidth = mix(1.0, 0.68, wake);
    float focusWidth = mix(1.0, min(uFocusScale, 1.72), 0.72);
    float pixelWidth = max(uMinPixelWidth * uPixelRatio, aWidth * kindWidth * depthWidth * focusWidth * uWidthScale * uPassWidth * uPixelRatio)
      * uPresentationScale;
    vec2 offset = perpendicular * aSide * pixelWidth * miter * 2.0 / uViewport;
    gl_Position = vec4(clipPoint + offset, 0.0, 1.0);

    vec3 royal = vec3(0.000387, 0.00309598, 0.26327341);
    vec3 electric = vec3(0.0006192, 0.02198095, 1.0);
    vec3 cyan = vec3(0.00077399, 0.11928019, 1.0);
    vec3 ice = vec3(0.00719441, 0.2956998, 1.0);
    vec3 colour = mix(royal, electric, smoothstep(0.0, 1.0, aColour));
    colour = mix(colour, cyan, smoothstep(1.0, 2.0, aColour));
    colour = mix(colour, ice, smoothstep(2.0, 3.0, aColour));
    colour *= mix(0.9, 1.12, aDepth * 0.5);
    vColour = colour;
    vAcross = aSide;
    vAlpha = aAlpha;
    vProgress = aArcPosition;
    vKind = aKind;
    vBand = aDepth;
    vSeed = aSeed;
    float gust = travellingGust(position.xy, aArcPosition, aBundlePhase, aDepth, aKind);
    vFlowPulse = smoothstep(0.56, 0.94, gust) * uMotionEnabled * mix(0.7, 1.0, step(0.75, aKind));
    vec4 currentPressure = pointerPressureSample(position.xy, uPointerPosition, uPointerStrength, uPointerRadius);
    vec4 trailPressure = pointerPressureSample(position.xy, uPointerTrailPosition, uPointerTrailStrength, uPointerRadius * 0.9);
    float currentEdgeWindow = smoothstep(0.18, 0.52, currentPressure.w)
      * (1.0 - smoothstep(0.9, 1.08, currentPressure.w));
    float trailEdgeWindow = smoothstep(0.2, 0.56, trailPressure.w)
      * (1.0 - smoothstep(0.88, 1.06, trailPressure.w));
    float pointerKindWeight = mix(0.44, 1.0, aFlexibility) * mix(0.58, 1.42, step(0.75, aKind));
    vPointerEnergy = (currentPressure.z * currentEdgeWindow + trailPressure.z * trailEdgeWindow * 0.34)
      * pointerKindWeight;
    vec2 pressureDirection = normalize(
      currentPressure.xy * currentPressure.z + trailPressure.xy * trailPressure.z * 0.38 + vec2(0.00001)
    );
    vec2 outwardClip = normalize(
      (imageToClip(position.xy + pressureDirection * 0.01, aDepth) - imageToClip(position.xy, aDepth))
        * uViewport
        + vec2(0.00001)
    );
    vPointerOutwardSide = dot(perpendicular, outwardClip);
    vCrawlSettled = crawlSettledAmount(crawlArc, crawlProgress);
    float visibleHead = min(1.0, crawlProgress + smoothstep(0.78, 1.0, crawlProgress) * 0.12);
    float headDistance = abs(crawlArc - visibleHead);
    vCrawlHead = (1.0 - smoothstep(0.02, 0.115, headDistance)) * (1.0 - step(0.9999, uWakeupProgress));
  }
`;

export const strandProofFragmentShader = /* glsl */ `
  uniform float uGlowPass;
  uniform float uPassAlpha;
  uniform float uRibbonLuminance;
  uniform float uHaloLuminance;
  varying float vAcross;
  varying float vAlpha;
  varying float vProgress;
  varying float vKind;
  varying float vBand;
  varying float vSeed;
  varying float vFlowPulse;
  varying float vPointerEnergy;
  varying float vPointerOutwardSide;
  varying float vCrawlSettled;
  varying float vCrawlHead;
  varying vec3 vColour;

  vec3 scaleBlueEnergy(vec3 colour, float energy) {
    float greenScale = sqrt(max(energy, 0.0));
    float redScale = sqrt(greenScale);
    return colour * vec3(redScale, greenScale, energy);
  }

  void main() {
    float across = abs(vAcross);
    float antialias = max(fwidth(across) * 0.9, 0.018);
    float ribbon = 1.0 - smoothstep(0.7 - antialias, 1.0 + antialias, across);
    float filament = 1.0 - smoothstep(0.02, 0.2 + antialias, across);
    float halo = 1.0 - smoothstep(0.0, 1.0 + antialias, across);
    float startTaper = smoothstep(0.0, 0.065, vProgress);
    float endTaper = 1.0 - smoothstep(0.9, 1.0, vProgress);
    float taper = startTaper * endTaper;
    float wake = step(0.75, vKind);
    float anatomicalWeight = mix(1.18, 0.76, wake);
    float rearBand = 1.0 - step(0.5, vBand);
    float middleBand = step(0.5, vBand) * (1.0 - step(1.5, vBand));
    float depthWeight = 1.05 + rearBand * 1.2 + middleBand * 0.95;
    float naturalVariation = clamp(
      0.82
        + 0.14 * sin(vSeed * 31.7 + vProgress * 4.1)
        + 0.08 * sin(vSeed * 73.1 - vProgress * 2.2),
      0.6,
      1.0
    );
    float baseShape = ribbon * 0.64 + filament * 0.36;
    float glowShape = halo * mix(0.24, 0.4, 1.0 - wake) + filament * 0.02;
    float shape = mix(baseShape, glowShape, uGlowPass);
    float flowLift = vFlowPulse * mix(0.055, 0.095, wake) * mix(1.06, 0.84, vBand * 0.5);
    float displacedOuterEdge = smoothstep(0.08, 0.78, vAcross * vPointerOutwardSide);
    float pointerLift = min(vPointerEnergy, 1.35) * displacedOuterEdge;
    float crawlPresence = mix(0.3, 1.0, vCrawlSettled);
    float fibreEnergy = crawlPresence + vCrawlHead * 0.1;
    float haloEnergy = mix(0.2, 1.0, vCrawlSettled) + vCrawlHead * 0.08;
    float alpha = vAlpha * taper * anatomicalWeight * depthWeight * naturalVariation * shape * uPassAlpha;
    alpha *= mix(fibreEnergy, haloEnergy, uGlowPass);
    alpha *= 1.0 + flowLift * 0.72 + pointerLift * mix(0.34, 0.78, uGlowPass);
    float persistentFilament = vAlpha * taper * anatomicalWeight * depthWeight * filament * uPassAlpha * mix(0.2, 0.035, uGlowPass) * fibreEnergy;
    alpha = max(alpha, persistentFilament);
    vec3 strandColour = mix(vColour, vec3(0.0003096, 0.00598106, 0.233022), wake * 0.14);
    vec3 bodyEnergy = scaleBlueEnergy(strandColour, uRibbonLuminance);
    vec3 filamentBlue = vec3(0.00154799, 0.08353513, 1.0);
    vec3 filamentEnergy = scaleBlueEnergy(filamentBlue, uRibbonLuminance * 0.72);
    vec3 ribbonColour = mix(bodyEnergy, filamentEnergy, filament * 0.34);
    vec3 softHaloColour = mix(strandColour, vec3(0.00077399, 0.01341175, 0.47699978), 0.2);
    softHaloColour = scaleBlueEnergy(softHaloColour, uHaloLuminance) * (0.64 + halo * 0.2);
    vec3 baseColour = mix(ribbonColour, softHaloColour, uGlowPass);
    baseColour *= mix(fibreEnergy, haloEnergy, uGlowPass);
    baseColour *= 1.0 + flowLift;
    vec3 pointerFlare = scaleBlueEnergy(vec3(0.0012, 0.075, 1.0), mix(1.2, uHaloLuminance * 0.48, uGlowPass));
    float pointerShape = mix(ribbon * 0.28 + filament * 0.08, halo * 0.42, uGlowPass);
    baseColour += pointerFlare * pointerLift * pointerShape;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(baseColour, min(alpha, 0.94));
    #include <colorspace_fragment>
  }
`;

export const strandProofPointVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aIntensity;
  attribute float aType;
  attribute float aPhase;
  attribute float aBundlePhase;
  attribute float aFlexibility;
  attribute float aDepth;
  attribute float aArcPosition;
  attribute vec2 aMotionTangent;
  attribute float aKind;
  attribute float aAttachment;
  attribute float aTravelDistance;
  attribute vec4 aCrawlData;
  uniform vec2 uViewport;
  uniform float uPixelRatio;
  uniform vec2 uFocusCenter;
  uniform float uFocusScale;
  uniform float uDepthStrength;
  uniform float uTime;
  uniform float uMotionEnabled;
  uniform float uMotionAmplitude;
  uniform float uMotionSpeed;
  uniform float uMotionCoherence;
  uniform float uPresentationScale;
  uniform float uPresentationRotation;
  uniform vec2 uPresentationTranslation;
  uniform float uWakeupProgress;
  uniform sampler2D uCrawlCurveTexture;
  uniform float uCrawlSampleCount;
  uniform vec2 uPointerPosition;
  uniform vec2 uPointerTrailPosition;
  uniform vec2 uPointerVelocity;
  uniform float uPointerStrength;
  uniform float uPointerTrailStrength;
  uniform float uPointerRadius;
  uniform float uPointerAmplitude;
  varying float vIntensity;
  varying float vType;
  varying float vBand;
  varying float vFlowPulse;
  varying float vPointerEnergy;
  varying float vLife;
  varying float vCrawlSettled;
  varying float vParticleEmergence;

  vec2 sampleCrawlCurve(float arcPosition, float lookupY) {
    float samplePosition = clamp(arcPosition, 0.0, 1.0) * (uCrawlSampleCount - 1.0);
    float lowerIndex = floor(samplePosition);
    float upperIndex = min(uCrawlSampleCount - 1.0, lowerIndex + 1.0);
    float interpolation = fract(samplePosition);
    return mix(
      texture2D(uCrawlCurveTexture, vec2((lowerIndex + 0.5) / uCrawlSampleCount, lookupY)).xy,
      texture2D(uCrawlCurveTexture, vec2((upperIndex + 0.5) / uCrawlSampleCount, lookupY)).xy,
      interpolation
    );
  }

  float curveCrawlProgress(float activationOrder, float kind) {
    if (uWakeupProgress >= 0.9999) return 1.0;
    float wake = step(0.75, kind);
    float start = 0.075 + activationOrder * 0.6;
    return smoothstep(start, min(0.995, start + mix(0.39, 0.32, wake)), uWakeupProgress);
  }

  float crawlSettledAmount(float crawlArc, float crawlProgress) {
    if (uWakeupProgress >= 0.9999) return 1.0;
    float settlementHead = crawlProgress + smoothstep(0.78, 1.0, crawlProgress) * 0.12;
    return 1.0 - smoothstep(settlementHead - 0.075, settlementHead + 0.045, crawlArc);
  }

  vec2 crawlCurvePoint(vec2 canonicalPoint, float crawlArc, float lookupY, float crawlProgress) {
    if (uWakeupProgress >= 0.9999) return canonicalPoint;
    float settled = crawlSettledAmount(crawlArc, crawlProgress);
    float compressedArc = crawlProgress + max(0.0, crawlArc - crawlProgress) * 0.045;
    float mappedArc = mix(clamp(compressedArc, 0.0, 1.0), crawlArc, settled);
    return canonicalPoint
      + sampleCrawlCurve(mappedArc, lookupY)
      - sampleCrawlCurve(crawlArc, lookupY);
  }

  float travellingGust(vec2 point, float arcPosition, float bundlePhase, float depth, float kind) {
    float wake = step(0.75, kind);
    float depthRate = mix(0.9, 1.08, depth * 0.5);
    float bundleDelay = sin(bundlePhase * 0.73) * 0.16 + cos(bundlePhase * 0.31) * 0.06;
    float narrowCarrier = point.x * 8.4
      + uTime * uMotionSpeed * depthRate * mix(1.0, 1.08, wake) * 1.46
      + arcPosition * 0.34
      + bundleDelay;
    float broadCarrier = point.x * 3.15
      + uTime * uMotionSpeed * depthRate * 0.54
      + bundlePhase * 0.075;
    float narrow = smoothstep(0.38, 0.93, sin(narrowCarrier) * 0.5 + 0.5);
    float broad = smoothstep(0.16, 0.9, sin(broadCarrier) * 0.5 + 0.5);
    float independentGust = 0.2 + narrow * 0.56 + broad * 0.24;

    float coherentDepthRate = mix(0.97, 1.03, depth * 0.5);
    float coherentDelay = sin(bundlePhase * 0.73) * 0.045 + cos(bundlePhase * 0.31) * 0.018;
    float coherentCarrier = point.x * 6.2
      + point.y * 0.72
      + uTime * uMotionSpeed * coherentDepthRate * mix(1.0, 1.03, wake) * 1.18
      + arcPosition * 0.12
      + coherentDelay;
    float coherentBroadCarrier = point.x * 2.55
      + point.y * 0.34
      + uTime * uMotionSpeed * coherentDepthRate * 0.46
      + bundlePhase * 0.022;
    float coherentNarrow = smoothstep(0.34, 0.92, sin(coherentCarrier) * 0.5 + 0.5);
    float coherentBroad = smoothstep(0.18, 0.9, sin(coherentBroadCarrier) * 0.5 + 0.5);
    float coherentGust = 0.29 + coherentNarrow * 0.45 + coherentBroad * 0.26;
    return mix(independentGust, coherentGust, uMotionCoherence);
  }

  vec4 pointerPressureSample(vec2 point, vec2 pointerPosition, float strength, float radius) {
    vec2 wind = normalize(vec2(-0.985, 0.172));
    float speed = length(uPointerVelocity);
    float speedWeight = smoothstep(0.015, 0.48, speed);
    vec2 velocityDirection = speed > 0.0001 ? normalize(uPointerVelocity) : wind;
    vec2 pressureAxis = normalize(mix(wind, velocityDirection, speedWeight) + vec2(0.00001));
    vec2 pressurePerpendicular = vec2(-pressureAxis.y, pressureAxis.x);
    vec2 delta = point - pointerPosition;
    float along = dot(delta, pressureAxis);
    float lateral = dot(delta, pressurePerpendicular);
    float safeRadius = max(radius, 0.0001);
    float forwardScale = mix(1.04, 1.22, speedWeight);
    float backwardScale = mix(1.1, 1.32, speedWeight);
    float longitudinalRadius = safeRadius * mix(backwardScale, forwardScale, step(0.0, along));
    float lateralRadius = safeRadius * mix(0.84, 0.76, speedWeight);
    float ellipseDistance = length(vec2(lateral / lateralRadius, along / longitudinalRadius));
    float influence = 1.0 - smoothstep(0.1, 1.04, ellipseDistance);
    influence = influence * influence * (3.0 - 2.0 * influence);

    vec2 radialOut = normalize(delta + pressurePerpendicular * 0.00001);
    float outwardVelocity = max(0.0, dot(pressureAxis, radialOut));
    vec2 outwardDirection = normalize(radialOut + pressureAxis * outwardVelocity * speedWeight * 0.12);
    float aheadWeight = mix(0.94, 1.08, smoothstep(-safeRadius * 0.44, safeRadius * 0.62, along));
    return vec4(outwardDirection, influence * strength * aheadWeight, ellipseDistance);
  }

  vec2 deformStrand(
    vec2 point,
    vec2 rawTangent,
    float arcPosition,
    float crawlArc,
    float lookupY,
    float activationOrder,
    float phase,
    float bundlePhase,
    float flexibility,
    float depth,
    float kind
  ) {
    if (uMotionEnabled < 0.5) return point;
    float crawlProgress = curveCrawlProgress(activationOrder, kind);
    vec2 crawledPoint = crawlCurvePoint(point, crawlArc, lookupY, crawlProgress);
    vec2 tangent = normalize(vec2(rawTangent.x, rawTangent.y * 1.5) + vec2(0.00001));
    vec2 wind = normalize(vec2(-0.985, 0.172));
    float wake = step(0.75, kind);
    float toe = step(0.25, kind) * (1.0 - step(0.75, kind));
    float independentDepthAmplitude = mix(1.08, 0.84, depth * 0.5);
    float coherentDepthAmplitude = mix(1.03, 0.95, depth * 0.5);
    float depthAmplitude = mix(independentDepthAmplitude, coherentDepthAmplitude, uMotionCoherence);
    float centerEnvelope = smoothstep(0.0, 0.16, arcPosition)
      * (1.0 - smoothstep(0.84, 1.0, arcPosition));
    float endpointFloor = mix(0.16, 0.46, wake);
    endpointFloor = mix(endpointFloor, 0.08, toe);
    float strandEnvelope = mix(endpointFloor, 1.0, centerEnvelope);
    float gust = travellingGust(point, arcPosition, bundlePhase, depth, kind);
    float independentLift = 0.88 + 0.12 * sin(point.x * 4.2 + uTime * uMotionSpeed * 0.22 + bundlePhase * 0.11);
    float coherentLift = 0.94 + 0.06 * sin(point.x * 3.1 + point.y * 0.7 + uTime * uMotionSpeed * 0.18 + bundlePhase * 0.025);
    float lift = mix(independentLift, coherentLift, uMotionCoherence);
    float independentKindAmplitude = mix(0.82, 2.04, wake) * mix(1.0, 0.48, toe);
    float coherentKindAmplitude = mix(0.88, 1.84, wake) * mix(1.0, 0.54, toe);
    float kindAmplitude = mix(independentKindAmplitude, coherentKindAmplitude, uMotionCoherence);
    float sharedFlexibility = mix(0.42, 0.82, wake);
    sharedFlexibility = mix(sharedFlexibility, 0.34, toe);
    float coherentFlexibility = mix(sharedFlexibility, flexibility, 0.22);
    float resolvedFlexibility = mix(flexibility, coherentFlexibility, uMotionCoherence);
    float crosswindLift = mix(0.075, 0.045, uMotionCoherence);
    float amplitude = uMotionAmplitude * resolvedFlexibility * depthAmplitude * kindAmplitude * strandEnvelope;
    float settledAtPoint = crawlSettledAmount(crawlArc, crawlProgress);
    float windBlend = mix(0.08, 1.0, smoothstep(0.02, 0.92, crawlProgress))
      * mix(0.32, 1.0, settledAtPoint);
    vec2 idleOffset = (wind * gust + vec2(0.0, gust * lift * crosswindLift)) * amplitude * windBlend;

    vec4 currentPressure = pointerPressureSample(point, uPointerPosition, uPointerStrength, uPointerRadius);
    vec4 trailPressure = pointerPressureSample(point, uPointerTrailPosition, uPointerTrailStrength, uPointerRadius * 0.9);
    vec2 pressureVector = currentPressure.xy * currentPressure.z + trailPressure.xy * trailPressure.z * 0.38;
    vec2 currentRadialOut = normalize(point - uPointerPosition + vec2(0.00001));
    pressureVector -= currentRadialOut * min(0.0, dot(pressureVector, currentRadialOut));
    float tangentialPressure = dot(pressureVector, tangent);
    pressureVector -= tangent * tangentialPressure * 0.62;
    pressureVector -= currentRadialOut * min(0.0, dot(pressureVector, currentRadialOut));
    float bundleResponse = 0.97 + 0.03 * sin(bundlePhase * 0.91 + phase * 0.17);
    float pointerKindResponse = mix(0.58, 1.2, wake) * mix(1.0, 0.42, toe);
    float pointerFlexibility = mix(0.7, 1.0, flexibility);
    float pointerCenterEnvelope = smoothstep(0.0, 0.16, arcPosition)
      * (1.0 - smoothstep(0.84, 1.0, arcPosition));
    float pointerEndpointFloor = mix(0.34, 0.52, wake);
    pointerEndpointFloor = mix(pointerEndpointFloor, 0.18, toe);
    float propagationEnvelope = mix(pointerEndpointFloor, 1.0, pointerCenterEnvelope);
    vec2 pointerOffset = pressureVector
      * uPointerAmplitude
      * bundleResponse
      * pointerKindResponse
      * pointerFlexibility
      * propagationEnvelope;
    float pointerClamp = uPointerAmplitude * mix(0.52, 0.96, wake) * mix(1.0, 0.42, toe);
    float pointerLength = length(pointerOffset);
    if (pointerLength > pointerClamp) pointerOffset *= pointerClamp / pointerLength;
    return crawledPoint + idleOffset + pointerOffset;
  }

  vec2 imageToClip(vec2 point, float band) {
    vec2 focused = (point - uFocusCenter) * uFocusScale + 0.5;
    float depth = band - 1.0;
    float layerScale = 1.0 + depth * uDepthStrength;
    vec2 parallax = depth * vec2(-0.0028, 0.0019) * uFocusScale;
    focused = (focused - 0.5) * layerScale + 0.5 + parallax;
    vec2 ndc = focused * 2.0 - 1.0;
    float viewportRatio = uViewport.x / max(uViewport.y, 1.0);
    float imageRatio = 2.0 / 3.0;
    vec2 fit = vec2(1.0);
    if (viewportRatio > imageRatio) fit.x = imageRatio / viewportRatio;
    else fit.y = viewportRatio / imageRatio;
    vec2 fitted = ndc * fit;
    float presentationCosine = cos(uPresentationRotation);
    float presentationSine = sin(uPresentationRotation);
    mat2 presentationRotation = mat2(
      presentationCosine,
      presentationSine,
      -presentationSine,
      presentationCosine
    );
    return presentationRotation * fitted * uPresentationScale + uPresentationTranslation;
  }

  void main() {
    float crawlProgress = curveCrawlProgress(aCrawlData.z, aKind);
    vec2 movedPoint = deformStrand(position.xy, aMotionTangent, aArcPosition, aCrawlData.y, aCrawlData.x, aCrawlData.z, aPhase, aBundlePhase, aFlexibility, aDepth, aKind);
    float wake = step(0.75, aKind);
    float gust = travellingGust(position.xy, aArcPosition, aBundlePhase, aDepth, aKind);
    float pulseWindow = smoothstep(0.56, 0.94, gust) * uMotionEnabled;
    float freeParticle = 1.0 - aAttachment;
    float travelCycle = fract(
      aBundlePhase * 0.15915494
        + aArcPosition * 0.61
        + uTime * uMotionSpeed * mix(0.19, 0.24, aDepth * 0.5)
    );
    float travelFade = smoothstep(0.0, 0.12, travelCycle)
      * (1.0 - smoothstep(0.82, 1.0, travelCycle));
    vec2 particleWind = normalize(vec2(-0.985, 0.172));
    movedPoint += particleWind * aTravelDistance * travelCycle * freeParticle;
    movedPoint.y += freeParticle * aTravelDistance * travelCycle * 0.045;
    gl_Position = vec4(imageToClip(movedPoint, aDepth), 0.0, 1.0);
    float focusSize = sqrt(min(uFocusScale, 2.25));
    gl_PointSize = clamp(aSize * uPixelRatio * focusSize * uPresentationScale * mix(1.0, 1.16, step(0.75, aType)) * (1.0 + pulseWindow * 0.12), 2.0 * uPixelRatio, 18.0 * uPixelRatio);
    vIntensity = aIntensity;
    vType = aType;
    vBand = aDepth;
    vFlowPulse = pulseWindow * mix(0.7, 1.0, wake);
    vLife = mix(1.0, travelFade, freeParticle);
    vCrawlSettled = crawlSettledAmount(aCrawlData.y, crawlProgress);
    vParticleEmergence = smoothstep(0.16, 0.76, uWakeupProgress) * mix(0.45, 1.0, vCrawlSettled);
    vec4 currentPressure = pointerPressureSample(position.xy, uPointerPosition, uPointerStrength, uPointerRadius);
    vec4 trailPressure = pointerPressureSample(position.xy, uPointerTrailPosition, uPointerTrailStrength, uPointerRadius * 0.9);
    float currentEdgeWindow = smoothstep(0.18, 0.52, currentPressure.w)
      * (1.0 - smoothstep(0.9, 1.08, currentPressure.w));
    float trailEdgeWindow = smoothstep(0.2, 0.56, trailPressure.w)
      * (1.0 - smoothstep(0.88, 1.06, trailPressure.w));
    vPointerEnergy = (currentPressure.z * currentEdgeWindow + trailPressure.z * trailEdgeWindow * 0.3)
      * mix(0.4, 1.0, aFlexibility)
      * mix(0.62, 1.36, wake);
  }
`;

export const strandProofPointFragmentShader = /* glsl */ `
  uniform float uPointLuminance;
  varying float vIntensity;
  varying float vType;
  varying float vBand;
  varying float vFlowPulse;
  varying float vPointerEnergy;
  varying float vLife;
  varying float vCrawlSettled;
  varying float vParticleEmergence;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point) * 2.0;
    float particle = 1.0 - smoothstep(0.48, 1.08, radius);
    float core = 1.0 - smoothstep(0.08, 0.38, radius);
    float halo = 1.0 - smoothstep(0.12, 1.0, radius);
    float rayX = exp(-abs(point.y) * 34.0) * (1.0 - smoothstep(0.08, 0.5, abs(point.x)));
    float rayY = exp(-abs(point.x) * 34.0) * (1.0 - smoothstep(0.08, 0.5, abs(point.y)));
    float highlightType = step(0.75, vType);
    float nodeType = step(0.25, vType) * (1.0 - highlightType);
    float highlight = core * 0.86 + halo * 0.2 + (rayX + rayY) * 0.18;
    float node = core * 0.68 + halo * 0.24;
    float shape = mix(particle * 0.72 + core * 0.08, node, nodeType);
    shape = mix(shape, highlight, highlightType);
    float alpha = shape * vIntensity * mix(1.02, 0.94, vBand * 0.5) * vLife;
    alpha = max(alpha, particle * vIntensity * vLife * mix(0.34, 0.44, nodeType));
    alpha *= vParticleEmergence;
    alpha *= 1.0 + vFlowPulse * mix(0.14, 0.3, highlightType) + vPointerEnergy * 0.42;
    vec3 particleColour = vec3(0.003, 0.19, 1.65);
    vec3 nodeColour = vec3(0.008, 0.34, 2.05);
    vec3 highlightColour = mix(vec3(0.025, 0.48, 2.15), vec3(0.54, 0.9, 2.55), core);
    vec3 colour = mix(particleColour, nodeColour, nodeType);
    colour = mix(colour, highlightColour, highlightType) * uPointLuminance;
    colour *= mix(0.72, 1.0, vCrawlSettled);
    colour *= 1.0 + vFlowPulse * mix(0.1, 0.26, highlightType);
    colour += vec3(0.004, 0.18, 1.5) * vPointerEnergy * (core * 0.7 + halo * 0.2);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(colour, min(alpha, 0.96));
    #include <colorspace_fragment>
  }
`;
