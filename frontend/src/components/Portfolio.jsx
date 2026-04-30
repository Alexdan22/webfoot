import { ArrowUpRight, TrendingUp, Dumbbell, Scissors, UtensilsCrossed, HeartPulse  } from "lucide-react";

const projects = [
  {
    icon: Dumbbell,
    title: "Fitness Gym",
    type: "Gym",
    metric: "+45% new member sign-ups",
    description:
      "New mobile-first site with one-click trial signup. Tripled monthly inbound trial bookings within 60 days.",
    tags: ["Mobile-first", "Lead capture", "Booking"],
    hue: "from-[#00F5D4]/20 via-[#00F5D4]/5 to-transparent",
  },
  {
    icon: Scissors,
    title: "Salons  & Spas",
    type: "Salon",
    metric: "5x bookings",
    description:
      "Conversion-focused redesign with built-in WhatsApp booking. Dropped no-shows, 5x more confirmed appointments.",
    tags: ["WhatsApp booking", "SEO", "Reviews"],
    hue: "from-[#3A86FF]/20 via-[#3A86FF]/5 to-transparent",
  },
  {
    icon: HeartPulse,
    title: "Clinics & Wellness",
    type: "Wellness",
    metric: "+40% patient bookings",
    description:
      "Streamlined appointment booking + patient inquiry system. Online consultations and bookings increased significantly within the first quarter.",
    tags: ["Appointments", "Patient Management", "Performance"],
    hue: "from-[#00F5D4]/20 via-[#3A86FF]/10 to-transparent",
  },
];

export default function Portfolio() {
  return (
    <section
      id="work"
      data-testid="portfolio-section"
      className="relative py-24 lg:py-32 bg-section-alt"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-14">
          <div className="max-w-2xl">
            <div className="font-mono-accent text-[var(--primary)] mb-4">
              / Selected Work
            </div>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02] text-white">
              Real businesses.
              <br />
              <span className="text-[var(--text-muted)]">Real results.</span>
            </h2>
          </div>
          <p className="text-[var(--text-secondary)] max-w-sm">
            Recent case studies — local shops, fitness, hospitality. Each site
            built with one goal: more customers.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-7">
          {projects.map((p, i) => {
            const Icon = p.icon;
            return (
              <article
                key={p.title}
                data-testid={`portfolio-card-${i}`}
                className="card-surface rounded-2xl overflow-hidden group cursor-pointer"
              >
                <div
                  className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${p.hue}`}
                >
                  <div className="absolute inset-0 dot-grid-dark opacity-40" />

                  <div className="absolute top-5 left-5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  </div>

                  <div className="absolute top-5 right-5">
                    <span className="font-mono-accent text-white bg-white/10 backdrop-blur-md px-2.5 py-1 border border-white/15 rounded-md">
                      {p.type}
                    </span>
                  </div>

                  <div className="absolute inset-0 grid place-items-center">
                    <div className="w-20 h-20 rounded-2xl grid place-items-center bg-white/8 backdrop-blur-md border border-white/15 group-hover:scale-110 transition-transform duration-500">
                      <Icon size={32} className="text-white" strokeWidth={1.6} />
                    </div>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/15">
                    <TrendingUp size={16} className="text-[var(--primary)]" />
                    <span className="font-display font-extrabold text-white">
                      {p.metric}
                    </span>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[var(--bg)]/0 group-hover:bg-[var(--bg)]/60 transition-colors duration-300" />
                </div>

                <div className="p-6 lg:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display font-extrabold text-xl tracking-tight text-white">
                      {p.title}
                    </h3>
                    <ArrowUpRight
                      size={20}
                      className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:rotate-45 transition-all"
                    />
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    {p.description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs text-[var(--text-secondary)] border border-white/10 px-2.5 py-1 bg-white/5 rounded-md"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
