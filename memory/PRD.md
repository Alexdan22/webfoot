# Webfoot — Freelancer Landing Page (Alex, Web Developer)

## Problem Statement
Build a conversion-focused single-page portfolio for "Webfoot" (personal freelance brand, Alex – Web Developer). Target: local & online businesses. Must include: Hero with dual CTAs (WhatsApp primary, View Services secondary), Services (3 cards), Technical Capabilities (frontend + backend + tools), 3-step Process, Portfolio (1–2 projects), Why Choose Me, pre-footer CTA, Contact (form + WhatsApp + email), Footer, and a globally sticky WhatsApp button. Mobile-first, clean, trustworthy.

## User Personas
- Local business owner looking for a website that generates calls/bookings.
- Online business owner needing a conversion-focused marketing site + backend.

## Core Requirements (static)
- Fast loading, clear navigation, sticky WhatsApp CTA everywhere.
- Repeated conversion CTAs across sections.
- Professional dark theme with signal-orange accent.
- Contact form persists leads in MongoDB.

## Architecture
- Backend: FastAPI + MongoDB (motor). Routes prefixed with `/api`. Models: `Lead`, `LeadCreate`.
- Frontend: React 19, Tailwind, Shadcn UI (sonner for toasts). Single page: `/` → `pages/Landing.jsx` composing `Navbar, Hero, Services, TechCapabilities, Process, Portfolio, WhyChooseMe, CTABanner, Contact, Footer, StickyWhatsApp`.
- Config: `frontend/src/config/site.js` holds brand, developer name, WhatsApp number, email.

## What's Implemented (Dec 2025)
- Backend: POST /api/leads, GET /api/leads (with limit clamp 1-500, sort desc), plus existing /api/status endpoints. MongoDB _id excluded in all responses.
- Frontend: Full landing page with dark theme (Cabinet Grotesk + Satoshi + JetBrains Mono via Fontshare), signal-orange accent, sticky WhatsApp FAB with pulse ring, glass navbar, bento-grid services, marquee tech stack, step process, portfolio cards, contact form wired to `/api/leads` with sonner toasts, mobile-first responsive.
- All interactive elements have `data-testid`.
- Backend tested: 14/14 pytest suites passing (iteration_1.json).

## Config Defaults
- Developer name: Alex
- WhatsApp: `+1234567890` (placeholder — user to update in `/app/frontend/src/config/site.js`)
- Email: `hello@webfoot.dev`

## Prioritized Backlog
- P1: Replace WhatsApp placeholder with real number; add real project screenshots & case studies.
- P1: Add a simple `/admin/leads` view (password-protected) to review submissions.
- P2: Add service-detail pages or expandable FAQs.
- P2: Add schema.org JSON-LD for local SEO + sitemap.xml/robots.txt.
- P2: Add testimonial section as social proof.
- P3: Add blog/case-study section for SEO.

## Next Tasks (if asked)
1. Replace WhatsApp placeholder when user shares real number.
2. Add real portfolio entries / logos.
3. Build simple admin view for leads.
