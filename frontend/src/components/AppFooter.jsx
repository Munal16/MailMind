import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import "./AppFooter.css";

function InstagramLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.4-1.4H16V5.5c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.2v1.8H9V14h2.4v7h2.1Z" />
    </svg>
  );
}

function WhatsAppLogo(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 3.2a8.7 8.7 0 0 0-7.5 13.1L3 21l4.9-1.3A8.8 8.8 0 1 0 12 3.2Zm0 15.8c-1.3 0-2.6-.3-3.7-1l-.3-.2-2.9.8.8-2.8-.2-.3a7 7 0 1 1 6.3 3.5Zm3.9-5.2c-.2-.1-1.1-.6-1.3-.6-.2-.1-.3-.1-.4.1-.1.2-.5.6-.6.8-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.6-1-.6-.5-1-1.1-1.1-1.3-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.3 0-.1 0-.2 0-.3 0-.1-.4-1.1-.6-1.5-.1-.3-.3-.3-.4-.3h-.4c-.1 0-.3.1-.5.3-.2.2-.6.6-.6 1.4s.6 1.7.7 1.8c.1.1 1.2 1.9 3 2.6 1.8.8 1.8.5 2.1.5.3 0 1.1-.4 1.2-.8.2-.4.2-.8.1-.8 0-.1-.2-.1-.4-.2Z" />
    </svg>
  );
}

const footerLinks = [
  { label: "Dashboard", href: "/app/dashboard" },
  { label: "Inbox", href: "/app/inbox" },
  { label: "Attachments", href: "/app/attachments" },
  { label: "Settings", href: "/app/settings" },
];

const socialLinks = [
  {
    label: "Instagram",
    meta: "Follow on Instagram",
    href: "https://www.instagram.com/banditorwot/",
    icon: InstagramLogo,
    tone: "instagram",
  },
  {
    label: "Facebook",
    meta: "Open Facebook page",
    href: "https://www.facebook.com/munal.pandey.39",
    icon: FacebookLogo,
    tone: "facebook",
  },
  {
    label: "WhatsApp",
    meta: "Chat on WhatsApp",
    href: "https://wa.me/9779848791255",
    icon: WhatsAppLogo,
    tone: "whatsapp",
  },
];

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__brand">
          <BrandLogo size="xs" />
          <p className="app-footer__text">
            MailMind keeps inbox review, task tracking, attachments, and daily email decisions inside one cleaner workspace.
          </p>
        </div>

        <div className="app-footer__menu">
          <div className="app-footer__title">Quick links</div>
          <div className="app-footer__links">
            {footerLinks.map((item) => (
              <Link key={item.label} to={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="app-footer__social">
          <div className="app-footer__title">Connect</div>
          <div className="app-footer__socials">
            {socialLinks.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="app-footer__social-card"
                >
                  <span className={`app-footer__social-icon app-footer__social-icon--${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="app-footer__social-copy">
                    <span className="app-footer__social-label">{item.label}</span>
                    <span className="app-footer__social-meta">{item.meta}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
