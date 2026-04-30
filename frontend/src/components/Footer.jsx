import { SITE } from "@/config/site";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      data-testid="site-footer"
      className="relative border-t border-white/10 py-12 bg-[var(--bg)]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 grid place-items-center rounded-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            <span className="w-2.5 h-2.5 bg-[var(--bg)]" />
          </span>
          <span className="font-display font-extrabold tracking-tight text-white">
            {SITE.brand}
          </span>
          <span className="font-mono-accent text-[var(--text-muted)]">
            / {SITE.developerName} — {SITE.role}
          </span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          © {year} {SITE.brand}. Built by {SITE.developerName}.
        </div>
      </div>
    </footer>
  );
}
