import { Monitor, Database, Sparkles, Check } from "lucide-react";

const columns = [
  {
    icon: Monitor,
    label: "Frontend",
    items: ["Responsive UI", "Mobile-first design", "Performance-focused"],
  },
  {
    icon: Database,
    label: "Backend",
    items: ["APIs & integrations", "Database systems", "Automation logic"],
  },
  {
    icon: Sparkles,
    label: "Approach",
    items: ["Clean architecture", "Scalable systems", "Maintainable code"],
  },
];

export default function TechCapabilities() {
  return (
    <section
      id="capabilities"
      data-testid="capabilities-section"
      className="relative py-24 lg:py-32 bg-section-alt"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-3xl mb-16">
          <div className="font-mono-accent text-[var(--primary)] mb-4">
            / Capabilities
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02] text-white">
            A complete toolkit.
            <br />
            <span className="text-[var(--text-muted)]">Used with intent.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-7">
          {columns.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                data-testid={`capability-col-${i}`}
                className="card-elevated rounded-2xl p-8 relative overflow-hidden"
              >
                <div
                  aria-hidden
                  className="absolute -top-6 -right-6 w-28 h-28 rounded-full"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(0,245,212,0.18), transparent 70%)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-8">
                    <div
                      className="w-12 h-12 rounded-xl grid place-items-center text-[var(--bg)]"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <span className="font-display font-extrabold text-xl text-white">
                      {c.label}
                    </span>
                  </div>
                  <div className="hairline mb-6" />
                  <ul className="space-y-4">
                    {c.items.map((it) => (
                      <li
                        key={it}
                        className="flex items-center gap-3 text-[var(--text-primary)]"
                      >
                        <Check size={16} className="text-[var(--primary)] shrink-0" strokeWidth={2.4} />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
