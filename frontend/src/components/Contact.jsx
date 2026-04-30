import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Mail, MessageCircle, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { SITE, whatsappLink } from "@/config/site";

const API = `${process.env.REACT_APP_BACKEND_URL}`;


export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    business_type: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Name, email and message are required.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/leads`, form);
      toast.success("Thanks! I'll send your design ideas shortly.");
      setForm({ name: "", email: "", phone: "", business_type: "", message: "" });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(
        typeof detail === "string"
          ? detail
          : "Something went wrong. Please try again or message on WhatsApp."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="contact"
      data-testid="contact-section"
      className="relative py-24 lg:py-32 bg-[var(--bg)]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5">
          <div className="font-mono-accent text-[var(--primary)] mb-4">
            / Contact
          </div>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.02] text-white">
            Let's Build a Website
            <br />
            That Actually <span className="text-gradient">Brings You Customers.</span>
          </h2>
          <p className="mt-6 text-[var(--text-secondary)]">
            Tell me about your business. I'll share tailored homepage ideas
            within 48 hours — no commitment.
          </p>

          <div className="mt-10 space-y-4">
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noreferrer"
              data-testid="contact-whatsapp-btn"
              className="btn-whatsapp flex items-center justify-between gap-4 px-6 py-4 rounded-xl"
            >
              <span className="flex items-center gap-3 font-semibold">
                <MessageCircle size={20} />
                Chat on WhatsApp
              </span>
              <span className="font-mono-accent">{SITE.whatsappNumber}</span>
            </a>
            <a
              href={`mailto:${SITE.email}`}
              data-testid="contact-email-link"
              className="btn-outline flex items-center justify-between gap-4 px-6 py-4 rounded-xl"
            >
              <span className="flex items-center gap-3 font-semibold">
                <Mail size={20} />
                Email
              </span>
              <span className="font-mono-accent">{SITE.email}</span>
            </a>

            <div className="flex items-center gap-3 mt-6 text-sm text-[var(--text-secondary)]">
              <ShieldCheck size={16} className="text-[var(--primary)]" />
              No commitment. Quick consultation.
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          data-testid="contact-form"
          className="lg:col-span-7 card-elevated rounded-2xl p-6 lg:p-10 space-y-5"
          noValidate
        >
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="font-mono-accent text-[var(--text-muted)] mb-2 block">
                Name *
              </label>
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                data-testid="contact-input-name"
                placeholder="Your name"
                className="input-dark w-full px-4 py-3 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="font-mono-accent text-[var(--text-muted)] mb-2 block">
                Email *
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                data-testid="contact-input-email"
                placeholder="you@business.com"
                className="input-dark w-full px-4 py-3 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="font-mono-accent text-[var(--text-muted)] mb-2 block">
                Phone
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={onChange}
                data-testid="contact-input-phone"
                placeholder="Optional"
                className="input-dark w-full px-4 py-3 rounded-xl"
              />
            </div>
            <div>
              <label className="font-mono-accent text-[var(--text-muted)] mb-2 block">
                Business Type
              </label>
              <input
                name="business_type"
                value={form.business_type}
                onChange={onChange}
                data-testid="contact-input-business"
                placeholder="Gym, Salon, Clinic..."
                className="input-dark w-full px-4 py-3 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="font-mono-accent text-[var(--text-muted)] mb-2 block">
              Project details *
            </label>
            <textarea
              name="message"
              value={form.message}
              onChange={onChange}
              data-testid="contact-input-message"
              rows={5}
              placeholder="Tell me a bit about your business and what you need."
              className="input-dark w-full px-4 py-3 rounded-xl resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
            <p className="text-xs text-[var(--text-muted)]">
              Your details stay private. I'll only use them to reply.
            </p>
            <button
              type="submit"
              disabled={loading}
              data-testid="contact-submit-btn"
              className="btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Get Your Website Design
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
