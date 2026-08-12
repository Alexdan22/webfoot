import { useId } from "react";
import {
  WEBFOOT_SOLE_PATH,
  WEBFOOT_TOES,
} from "@/components/hero/webfootFootprintGeometry";

const serviceNodes = [
  { x: 71, y: 16, label: "Websites" },
  { x: 82, y: 42, label: "Search" },
  { x: 79, y: 67, label: "Commerce" },
  { x: 25, y: 61, label: "Automation" },
  { x: 48, y: 86, label: "Analytics" },
];

export default function FootprintFallback({ className = "" }) {
  const patternId = `webfoot-static-${useId().replace(/:/g, "")}`;

  return (
    <div
      aria-hidden="true"
      data-testid="hero-particle-static-fallback"
      className={`footprint-static ${className}`.trim()}
    >
      <svg
        className="footprint-static-svg"
        viewBox="0 0 64 64"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
      >
        <defs>
          <pattern
            id={patternId}
            width="2.35"
            height="2.35"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.64" cy="0.65" r="0.38" fill="#52d9ff" opacity="0.78" />
            <circle cx="1.92" cy="1.82" r="0.23" fill="#8b7cff" opacity="0.58" />
          </pattern>
        </defs>

        <g fill={`url(#${patternId})`}>
          {WEBFOOT_TOES.map((toe) => (
            <ellipse
              key={`${toe.cx}-${toe.cy}`}
              cx={toe.cx}
              cy={toe.cy}
              rx={toe.rx}
              ry={toe.ry}
              transform={`rotate(${toe.rotation} ${toe.cx} ${toe.cy})`}
            />
          ))}
          <path d={WEBFOOT_SOLE_PATH} />
        </g>
      </svg>

      {serviceNodes.map((node) => (
        <span
          key={node.label}
          className="footprint-static-node"
          style={{ "--particle-x": `${node.x}%`, "--particle-y": `${node.y}%` }}
        >
          <span className="sr-only">{node.label}</span>
        </span>
      ))}
    </div>
  );
}
