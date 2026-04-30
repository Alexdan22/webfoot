// Shared site configuration
export const SITE = {
  brand: "Webfoot",
  developerName: "Alex",
  role: "Web Developer",
  email: "alex@webfoot.site",
  whatsappNumber: "+917676748605",
  whatsappDefaultMessage:
    `Hi, I’d like a website for my business.

Business type:
What I need (new site / redesign):
Timeline:`,
};

export const whatsappLink = (customMsg) => {
  const num = SITE.whatsappNumber.replace(/\D/g, "");
  const msg = encodeURIComponent(customMsg || SITE.whatsappDefaultMessage);
  return `https://wa.me/${num}?text=${msg}`;
};
