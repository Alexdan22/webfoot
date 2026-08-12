import { lazy, Suspense, useEffect, useRef, useState } from "react";
import FootprintFallback from "@/components/hero/FootprintFallback";

const ParticleFootprintCanvas = lazy(
  () => import("@/components/hero/ParticleFootprintCanvas"),
);

const serviceLabels = ["Websites", "Search", "Commerce", "Automation", "Analytics"];

function isLowCapabilityDevice() {
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;

  return Boolean(connection?.saveData) || cores <= 2 || memory <= 2;
}

export default function HeroParticleVisual() {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const moduleRef = useRef(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = moduleRef.current;
    let isVisible = false;
    let idleId;
    let timerId;
    let observer;

    const cancelScheduledLoad = () => {
      if (idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timerId) window.clearTimeout(timerId);
      idleId = undefined;
      timerId = undefined;
    };

    const scheduleLoad = () => {
      if (
        !isVisible ||
        reducedMotion.matches ||
        isLowCapabilityDevice() ||
        typeof window.HTMLCanvasElement === "undefined"
      ) {
        return;
      }

      cancelScheduledLoad();
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => setShouldAnimate(true), {
          timeout: 360,
        });
      } else {
        timerId = window.setTimeout(() => setShouldAnimate(true), 120);
      }
    };

    const onMotionPreferenceChange = () => {
      if (reducedMotion.matches) {
        cancelScheduledLoad();
        setShouldAnimate(false);
      } else {
        scheduleLoad();
      }
    };

    if ("IntersectionObserver" in window && root) {
      observer = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible) scheduleLoad();
        },
        { rootMargin: "120px 0px", threshold: 0.01 },
      );
      observer.observe(root);
    } else {
      isVisible = true;
      scheduleLoad();
    }

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", onMotionPreferenceChange);
    } else {
      reducedMotion.addListener(onMotionPreferenceChange);
    }

    return () => {
      cancelScheduledLoad();
      observer?.disconnect();
      if (typeof reducedMotion.removeEventListener === "function") {
        reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      } else {
        reducedMotion.removeListener(onMotionPreferenceChange);
      }
    };
  }, []);

  return (
    <div
      ref={moduleRef}
      aria-hidden="true"
      data-testid="hero-particle-module"
      className="hero-particle-module"
    >
      <div className="hero-particle-instrument">
        <span>Digital presence map</span>
        <span className="hero-particle-status">
          <i /> Network active
        </span>
      </div>

      <div className="hero-particle-stage">
        {shouldAnimate ? (
          <Suspense fallback={<FootprintFallback />}>
            <ParticleFootprintCanvas />
          </Suspense>
        ) : (
          <FootprintFallback />
        )}
      </div>

      <div className="hero-particle-legend">
        {serviceLabels.map((label, index) => (
          <span key={label}>
            <i style={{ "--legend-delay": index }} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
