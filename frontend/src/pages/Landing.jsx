import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  CheckSquare,
  Paperclip,
  Search,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import BrandLogo from "../components/BrandLogo";
import "./Landing.css";

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

const navItems = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Security", href: "#security" },
  { label: "Contact", href: "#contact" },
];

const featureCards = [
  {
    icon: Zap,
    title: "See urgent emails first",
    description: "Bring time-sensitive messages to the front so important conversations do not get buried.",
  },
  {
    icon: Target,
    title: "Understand email intent",
    description: "Quickly separate updates, verification emails, general messages, and promotions into clearer lanes.",
  },
  {
    icon: CheckSquare,
    title: "Turn emails into tasks",
    description: "Pull action points from incoming messages so your team can focus on what needs to be done next.",
  },
  {
    icon: Paperclip,
    title: "Keep files organized",
    description: "View attachments in one place and sort them by sender, project, file type, and date.",
  },
  {
    icon: Search,
    title: "Search across everything",
    description: "Find emails, tasks, and attachments from one search surface without jumping between pages.",
  },
  {
    icon: BarChart3,
    title: "Track inbox activity",
    description: "Monitor workload, email pressure, pending tasks, and file activity from one dashboard.",
  },
];

const workflowSteps = [
  {
    title: "Connect your Gmail account",
    description: "Securely link Gmail to start bringing live email activity into MailMind.",
  },
  {
    title: "Let MailMind organize the inbox",
    description: "New emails are synced, sorted, labeled, and prepared for faster review.",
  },
  {
    title: "Work from one clean workspace",
    description: "Move through email, tasks, attachments, and analytics without losing context.",
  },
];

const securityPoints = [
  "Secure Gmail connection through Google OAuth",
  "Read-only mailbox access for email intelligence workflows",
  "Clear profile, notification, and account controls inside the app",
];

const footerLinks = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Security", href: "#security" },
  { label: "Login", href: "/login", internal: true },
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

export default function Landing() {
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setHeaderScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-page" id="top">
      <div className="landing-page__veil" />

      <header className={`landing-page__header${headerScrolled ? " landing-page__header--scrolled" : ""}`}>
        <div className="landing-page__container landing-page__header-inner">
          <Link to="/" className="landing-page__brand-link">
            <BrandLogo size="sm" />
          </Link>

          <nav className="landing-page__nav">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="landing-page__nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="landing-page__header-actions">
            <Link to="/login">
              <Button variant="ghost" className="landing-page__ghost-button">
                Sign in
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="hero" className="landing-page__hero-button">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-page__container landing-hero__inner">
            <div className="landing-hero__copy">
              <div className="landing-hero__eyebrow">
                <Sparkles className="h-4 w-4" />
                Smarter email workflow
              </div>

              <h1 className="landing-hero__title">Keep your inbox clear, organized, and ready for action.</h1>

              <p className="landing-hero__description">
                MailMind helps you sort emails, spot urgent messages, extract tasks, manage attachments, and stay on top
                of daily communication from one clean workspace.
              </p>

              <div className="landing-hero__actions">
                <Link to="/register">
                  <Button variant="hero" size="lg" className="landing-page__hero-button">
                    Get Started
                  </Button>
                </Link>
                <a href="#features" className="landing-page__inline-link">
                  Explore features
                </a>
              </div>

              <div className="landing-hero__checks">
                <div className="landing-hero__check-item">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Focused inbox triage for real daily work</span>
                </div>
                <div className="landing-hero__check-item">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Tasks, files, and analytics connected in one place</span>
                </div>
                <div className="landing-hero__check-item">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Built for a polished customer-ready experience</span>
                </div>
              </div>
            </div>

            <div className="landing-hero__visual">
              <div className="landing-hero__mockup">
                <div className="landing-hero__mockup-bar">
                  <div className="landing-hero__mockup-dot-group">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-hero__mockup-search">Search emails, tasks, attachments...</div>
                </div>

                <div className="landing-hero__mockup-grid">
                  <aside className="landing-hero__mockup-sidebar">
                    <div className="landing-hero__mockup-section-title">Workspace</div>
                    <div className="landing-hero__mockup-nav-item landing-hero__mockup-nav-item--active">Inbox</div>
                    <div className="landing-hero__mockup-nav-item">Tasks</div>
                    <div className="landing-hero__mockup-nav-item">Attachments</div>
                    <div className="landing-hero__mockup-nav-item">Analytics</div>
                  </aside>

                  <div className="landing-hero__mockup-content">
                    <div className="landing-hero__mockup-panel">
                      <div className="landing-hero__panel-header">
                        <div>
                          <div className="landing-hero__panel-title">Inbox Overview</div>
                          <div className="landing-hero__panel-text">Review what matters first without losing file or task context.</div>
                        </div>
                        <div className="landing-hero__panel-pill">Live view</div>
                      </div>

                      {[
                        {
                          sender: "Legal Team",
                          subject: "Contract signature required",
                          urgency: "High",
                          intent: "Verification",
                        },
                        {
                          sender: "Operations",
                          subject: "Weekly launch update",
                          urgency: "Medium",
                          intent: "Updates",
                        },
                        {
                          sender: "Finance",
                          subject: "Invoice package with attachments",
                          urgency: "Low",
                          intent: "General",
                        },
                      ].map((row) => (
                        <div key={row.subject} className="landing-hero__mail-row">
                          <div className="landing-hero__mail-avatar">{row.sender.slice(0, 2).toUpperCase()}</div>
                          <div className="landing-hero__mail-copy">
                            <div className="landing-hero__mail-subject">{row.subject}</div>
                            <div className="landing-hero__mail-sender">{row.sender}</div>
                          </div>
                          <div className="landing-hero__mail-tags">
                            <span className={`landing-hero__mail-tag landing-hero__mail-tag--${row.urgency.toLowerCase()}`}>
                              {row.urgency}
                            </span>
                            <span className="landing-hero__mail-tag landing-hero__mail-tag--neutral">{row.intent}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="landing-hero__bottom-grid">
                      <div className="landing-hero__summary-card">
                        <div className="landing-hero__summary-title">Attachments</div>
                        <div className="landing-hero__summary-value">PDFs, docs, images</div>
                        <div className="landing-hero__summary-text">See files with sender and source email details.</div>
                      </div>

                      <div className="landing-hero__summary-card landing-hero__summary-card--accent">
                        <div className="landing-hero__summary-title">Tasks</div>
                        <div className="landing-hero__summary-value">Ready to follow up</div>
                        <div className="landing-hero__summary-text">Turn important asks into clear next steps.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-page__container">
            <div className="landing-section__header">
              <div className="landing-section__eyebrow">Features</div>
              <h2 className="landing-section__title">Everything MailMind needs to feel useful from the first day.</h2>
              <p className="landing-section__description">
                The landing experience should clearly tell customers what they are getting: a better inbox, clearer task
                visibility, cleaner file handling, and faster email decision-making.
              </p>
            </div>

            <div className="landing-feature-grid">
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article key={feature.title} className="landing-feature-card">
                    <div className="landing-feature-card__icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="landing-feature-card__title">{feature.title}</h3>
                    <p className="landing-feature-card__description">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="landing-section landing-section--soft">
          <div className="landing-page__container landing-workflow">
            <div className="landing-workflow__intro">
              <div className="landing-section__eyebrow">Workflow</div>
              <h2 className="landing-section__title">A simple flow that users can understand right away.</h2>
              <p className="landing-section__description">
                Connect Gmail, sync live emails, and work through everything inside one modern dashboard. That flow should
                feel immediate, calm, and easy to trust.
              </p>
            </div>

            <div className="landing-workflow__steps">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="landing-workflow__step">
                  <div className="landing-workflow__number">0{index + 1}</div>
                  <div className="landing-workflow__content">
                    <h3 className="landing-workflow__title">{step.title}</h3>
                    <p className="landing-workflow__description">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="landing-section">
          <div className="landing-page__container landing-security">
            <div className="landing-security__copy">
              <div className="landing-section__eyebrow">Trust</div>
              <h2 className="landing-section__title">Professional enough to present, stable enough to deploy.</h2>
              <p className="landing-section__description">
                MailMind is built around secure sign-in, clear account controls, and a cleaner experience for people who
                need to move through email without noise.
              </p>
            </div>

            <div className="landing-security__panel">
              <div className="landing-security__panel-icon">
                <Shield className="h-5 w-5" />
              </div>
              <div className="landing-security__panel-title">Why customers can trust the workflow</div>
              <div className="landing-security__panel-list">
                {securityPoints.map((item) => (
                  <div key={item} className="landing-security__panel-item">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--cta">
          <div className="landing-page__container">
            <div className="landing-cta">
              <div>
                <div className="landing-section__eyebrow">Start now</div>
                <h2 className="landing-section__title landing-section__title--light">Bring your inbox into a cleaner, smarter workflow.</h2>
                <p className="landing-section__description landing-section__description--light">
                  Start with MailMind and give your users a better way to handle email, tasks, files, and daily inbox pressure.
                </p>
              </div>

              <div className="landing-cta__actions">
                <Link to="/register">
                  <Button variant="hero" size="lg" className="landing-page__cta-primary">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer" id="contact">
        <div className="landing-page__container landing-footer__inner">
          <div className="landing-footer__brand-column">
            <div className="landing-footer__brand-block">
              <BrandLogo size="xs" />
            </div>
            <p className="landing-footer__text">
              MailMind gives teams one clean place to manage inbox activity, tasks, attachments, and email insights.
            </p>
          </div>

          <div className="landing-footer__menu-column">
            <div className="landing-footer__title">Quick links</div>
            <div className="landing-footer__links">
              {footerLinks.map((item) =>
                item.internal ? (
                  <Link key={item.label} to={item.href}>
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.label} href={item.href}>
                    {item.label}
                  </a>
                )
              )}
            </div>
          </div>

          <div className="landing-footer__social-column">
            <div className="landing-footer__title">Connect</div>
            <div className="landing-footer__socials">
              {socialLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="landing-footer__social-card"
                  >
                    <span className={`landing-footer__social-icon landing-footer__social-icon--${item.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="landing-footer__social-copy">
                      <span className="landing-footer__social-label">{item.label}</span>
                      <span className="landing-footer__social-meta">{item.meta}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
