import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { SITE } from "@/config/site";

const links = [
  { href: "#work", label: "Work" },
  { href: "#services", label: "Services" },
  { href: "#process", label: "Process" },
  { href: "#why", label: "Why Me" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="site-navbar"
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg)]/70 backdrop-blur-xl border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <a
          href="#top"
          data-testid="navbar-brand"
          className="flex items-center gap-2"
        >
          <span
            className="w-7 h-7 grid place-items-center rounded-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            <span className="w-2.5 h-2.5 bg-[var(--bg)]" />
          </span>
          <span className="font-display font-extrabold text-lg tracking-tight text-white">
            {SITE.brand}
          </span>
          <span className="font-mono-accent text-[var(--text-muted)] hidden sm:inline">
            / {SITE.developerName}
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            data-testid="navbar-cta-btn"
            className="hidden sm:inline-flex items-center gap-2 btn-primary px-5 py-2.5 text-sm font-semibold rounded-full"
          >
            Get Website
            <ArrowRight size={15} />
          </a>
          <button
            data-testid="navbar-mobile-toggle"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden text-white p-2"
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          data-testid="navbar-mobile-menu"
          className="md:hidden bg-[var(--bg)]/95 backdrop-blur-xl border-t border-white/10"
        >
          <div className="px-6 py-6 flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                data-testid={`nav-mobile-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-[var(--text-secondary)] hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              data-testid="nav-mobile-cta-btn"
              className="btn-primary px-5 py-3 text-sm font-semibold rounded-full text-center inline-flex items-center justify-center gap-2"
            >
              Get Website <ArrowRight size={15} />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
