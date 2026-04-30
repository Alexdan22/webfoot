import { Target, Zap, Smartphone, ArrowUpRight, Check } from "lucide-react";

const services = [
  {
    icon: Target,
    title: "Lead-Generating Websites",
    description:
      "Custom-built sites engineered to turn visitors into calls, bookings, and customers — not just clicks.",
    points: [
      "Conversion-focused layouts",
      "Built-in lead capture & forms",
      "SEO-ready foundations",
    ],
  },
  {
    icon: Zap,
    title: "Business Automation Systems",
    description:
      "Backends, APIs and automations that quietly run your business while you focus on customers.",
    points: [
      "API & third-party integrations",
      "Database & CRM workflows",
      "Custom automation logic",
    ],
  },
  {
    icon: Smartphone,
    title: "Mobile-Optimized Experience",
    description:
      "Most of your customers are on a phone. Your site should feel native there — fast, light, easy to act on.",
    points: [
      "Mobile-first design",
      "Fast-loading & lightweight",
      "Tap-to-call & WhatsApp ready",
    ],
  },
];

export default function Services() {
  return (
    <section
      id="services"
      data-testid="services-section"
      className="relative py-24 lg:py-32 bg-[var(--bg)]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-3xl mb-16">
          <div className="font-mono-accent text-[var(--primary)] mb-4">
            / Services
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02] text-white">
            What I build.
            <br />
            <span className="text-[var(--text-muted)]">Outcomes, not features.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-7">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <article
                key={s.title}
                data-testid={`service-card-${i}`}
                className="card-surface p-8 rounded-2xl flex flex-col group"
              >
                <div className="flex items-start justify-between mb-10">
                  <div
                    className="w-14 h-14 rounded-xl grid place-items-center text-[var(--bg)]"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Icon size={24} strokeWidth={1.8} />
                  </div>
                  <span className="font-mono-accent text-[var(--text-muted)]">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-display font-extrabold text-xl lg:text-2xl mb-3 tracking-tight text-white">
                  {s.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  {s.description}
                </p>
                <ul className="mt-auto space-y-3 pt-6 border-t border-white/10">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-3 text-sm text-[var(--text-primary)]"
                    >
                      <span className="w-5 h-5 rounded-full grid place-items-center bg-[var(--primary-soft)] border border-[var(--primary)]/30">
                        <Check size={12} className="text-[var(--primary)]" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center gap-2 text-sm text-[var(--primary)] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more
                  <ArrowUpRight size={16} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
