import { MessageCircle } from "lucide-react";
import { whatsappLink, SITE } from "@/config/site";

export default function StickyWhatsApp() {
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      data-testid="sticky-whatsapp-btn"
      className="pulse-soft fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full btn-whatsapp grid place-items-center shadow-lg"
      title={`Chat with ${SITE.developerName} on WhatsApp`}
    >
      <MessageCircle size={24} strokeWidth={2} />
    </a>
  );
}
