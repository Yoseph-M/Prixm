import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

interface FaqItem {
  question: string;
  answer: string;
  open: boolean;
}

export const LandingPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const currentYear = new Date().getFullYear();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [faqs, setFaqs] = useState<FaqItem[]>([
    {
      question: 'What is Prixm?',
      answer:
        'Prixm is all-in-one subscription software that helps you track recurring payments, renewal dates, and spending across every service you use.',
      open: false,
    },
    {
      question: 'How does pricing work?',
      answer:
        'Start free with up to five subscriptions. Upgrade to Pro or Team when you need unlimited tracking, analytics, or shared workspaces.',
      open: false,
    },
    {
      question: 'Can I connect my existing accounts?',
      answer:
        'Yes. Add subscriptions manually or import from email. Bank connections are available on Pro and Team plans.',
      open: false,
    },
    {
      question: 'Are renewal alerts included in all plans?',
      answer:
        'Basic email reminders are included on Free. Pro and Team add smart alerts, calendar sync, and customizable lead times.',
      open: false,
    },
    {
      question: 'How long does setup take?',
      answer:
        'Most users add their first subscriptions and see a full dashboard in under two minutes.',
      open: false,
    },
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // initial call

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = wrapperRef.current?.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    elements?.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  const toggleFaq = (index: number) => {
    setFaqs((prev) =>
      prev.map((faq, i) => ({
        ...faq,
        open: i === index ? !faq.open : false,
      }))
    );
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div ref={wrapperRef} className="landing-page-wrapper dark">
      {/* Navbar */}
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="nav-logo">
          <img src="/logo.png" alt="Prixm" className="logo-img" />
        </Link>
        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
              <button className="btn btn-accent" onClick={handleSignOut} type="button">Sign Out</button>
            </>
          ) : (
            <Link to="/auth" className="btn btn-accent">Get Started</Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="aurora-container" aria-hidden="true">
          <div className="aurora-effect"></div>
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow hero-in hero-in-1">
            <span className="eyebrow-dot"></span>
            Subscription Intelligence Platform
          </div>
          <h1 className="hero-title hero-in hero-in-2">
            Every subscription.<br />One clear view.
          </h1>
          <p className="hero-subtitle hero-in hero-in-3">
            Prixm unifies every recurring payment into one intelligent platform.
            Track spending, predict renewals, and eliminate waste — automatically.
          </p>
          <div className="hero-actions hero-in hero-in-4">
            <Link to="/auth" className="btn btn-accent btn-lg">Get Started Free</Link>
            <a href="#platform" className="btn btn-ghost btn-lg">See how it works</a>
          </div>
        </div>
        {/* Floating social proof */}
        <div className="hero-proof hero-in hero-in-4">
          <div className="proof-pill">
            <span className="proof-avatars">
              <span className="proof-avatar" style={{ background: '#8b1a1a' }}>J</span>
              <span className="proof-avatar" style={{ background: '#333' }}>M</span>
              <span className="proof-avatar" style={{ background: '#555' }}>A</span>
            </span>
            <span className="proof-text">Trusted by <strong>50,000+</strong> users</span>
          </div>
        </div>
      </section>

      {/* Tagline */}
      <section className="section tagline-section">
        <div className="section-inner">
          <p className="tagline-label reveal">PRIXM</p>
          <h2 className="tagline-heading reveal">Trusted. Powerful. Candid.</h2>
          <p className="tagline-sub reveal">
            We built Prixm to give individuals and teams complete visibility into their
            recurring expenses — with zero noise and total transparency.
          </p>
        </div>
      </section>

      {/* Feature Highlight Cards */}
      <section className="section feature-highlights-section">
        <div className="section-inner">
          <div className="highlight-grid">
            <div className="highlight-card reveal">
              <div className="highlight-visual highlight-red">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3>Unified Dashboard</h3>
              <p>All your subscriptions in one single starting point. Always correct, always up to date.</p>
            </div>
            <div className="highlight-card reveal">
              <div className="highlight-visual highlight-dim">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3>Spending Analytics</h3>
              <p>Visualize recurring costs with category breakdowns, trends, and provider comparisons.</p>
            </div>
            <div className="highlight-card reveal">
              <div className="highlight-visual highlight-dim">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3>Smart Alerts</h3>
              <p>Get notified before renewals, price hikes, and trial expirations. No more surprise charges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Row */}
      <section className="section stats-section">
        <div className="stats-grid reveal">
          <div className="stat-card">
            <h3 className="stat-number">$2.4M+</h3>
            <p className="stat-label">Saved by users annually</p>
          </div>
          <div className="stat-card">
            <h3 className="stat-number">50K+</h3>
            <p className="stat-label">Subscriptions tracked</p>
          </div>
          <div className="stat-card">
            <h3 className="stat-number">99.9%</h3>
            <p className="stat-label">Uptime reliability</p>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="platform" className="section platform-section">
        <div className="section-inner">
          <p className="section-eyebrow reveal">PLATFORM</p>
          <h2 className="section-title reveal">Everything you need to stay in control</h2>
          <div className="features-duo">
            <div className="feature-card-dark reveal">
              <div className="feature-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3>Unified Dashboard</h3>
              <p>See every subscription, renewal date, and monthly total in one place. No spreadsheets, no exports. Price changes are detected automatically.</p>
            </div>
            <div className="feature-card-dark reveal">
              <div className="feature-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                  <path d="M22 20H2" />
                </svg>
              </div>
              <h3>Spending Analytics</h3>
              <p>Visualize your recurring costs with detailed breakdowns by category, trend, and provider. Spot waste before it compounds.</p>
            </div>
          </div>
          <div className="features-duo">
            <div className="feature-card-dark reveal">
              <div className="feature-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3>Smart Alerts</h3>
              <p>Get notified before renewals, price hikes, and trial expirations. Never pay for something you forgot about again.</p>
            </div>
            <div className="feature-card-dark reveal">
              <div className="feature-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3>Bank-Grade Security</h3>
              <p>Your financial data is encrypted end-to-end. We never store credentials or share data with third parties.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Big Statement */}
      <section id="solutions" className="section statement-section">
        <div className="section-inner">
          <h2 className="statement-text reveal">
            We help people who<br />manage the hard<br />subscriptions.
          </h2>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="section">
        <div className="section-inner">
          <div className="solutions-grid">
            <div className="solution-card reveal">
              <div className="solution-card-visual solution-visual-1">
                <div className="solution-icon-wrap">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>
              <h4>Individuals</h4>
              <p>Track personal subscriptions across streaming, software, fitness, and more. See exactly where your money goes each month.</p>
            </div>
            <div className="solution-card reveal">
              <div className="solution-card-visual solution-visual-2">
                <div className="solution-icon-wrap">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              <h4>Teams</h4>
              <p>Shared workspaces for teams managing SaaS tools. Coordinate licenses, avoid duplicate subscriptions, and control costs.</p>
            </div>
            <div className="solution-card reveal">
              <div className="solution-card-visual solution-visual-3">
                <div className="solution-icon-wrap">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
              </div>
              <h4>Enterprises</h4>
              <p>Full visibility into company-wide recurring spend. Compliance-ready reports, approval workflows, and vendor management.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Embrace Tech Section */}
      <section className="section embrace-section">
        <div className="section-inner">
          <h2 className="embrace-heading reveal">
            Embracing technologies<br />that advance your finances
          </h2>
          <div className="tech-pills reveal">
            <span className="tech-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
              End-to-end encryption
            </span>
            <span className="tech-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Real-time sync
            </span>
            <span className="tech-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Smart anomaly detection
            </span>
            <span className="tech-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Bank-grade security
            </span>
            <span className="tech-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              Open API
            </span>
            <span className="tech-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
              Multi-currency
            </span>
          </div>
        </div>
      </section>

      {/* Trusted Logos */}
      <section className="section trusted-section">
        <div className="section-inner">
          <p className="trusted-label reveal">Integrated with the tools you already use</p>
          <div className="trusted-logos reveal">
            <span className="trusted-logo">STRIPE</span>
            <span className="trusted-logo">PLAID</span>
            <span className="trusted-logo">REVOLUT</span>
            <span className="trusted-logo">WISE</span>
            <span className="trusted-logo">PAYPAL</span>
          </div>
        </div>
      </section>

      {/* About / Team */}
      <section id="about" className="section team-section">
        <div className="section-inner">
          <h2 className="section-title section-center reveal">The people behind<br />Prixm</h2>
          <p className="team-intro section-center reveal">A small, focused team obsessed with making subscription management simple and honest.</p>
          <div className="team-grid">
            <div className="team-member-col reveal">
              <h4>Founders</h4>
              <p>We started Prixm after watching friends and colleagues overpay on forgotten subscriptions for years. We believed there had to be a better way.</p>
              <p className="team-stat">3</p>
              <p className="team-stat-label">Co-founders</p>
            </div>
            <div className="team-member-col reveal">
              <h4>Engineers</h4>
              <p>Our engineering team is distributed across three continents, building robust infrastructure that can handle the complexity of real financial data.</p>
              <p className="team-stat">12</p>
              <p className="team-stat-label">Engineers</p>
            </div>
            <div className="team-member-col reveal">
              <h4>Support</h4>
              <p>Real humans who respond within minutes. Our support team works around the clock because your subscriptions don't sleep.</p>
              <p className="team-stat">24/7</p>
              <p className="team-stat-label">Availability</p>
            </div>
            <div className="team-member-col reveal">
              <h4>Design</h4>
              <p>We believe beautiful software isn't a luxury. Every screen in Prixm is crafted to reduce friction and help you make better financial decisions faster.</p>
              <p className="team-stat">5</p>
              <p className="team-stat-label">Designers</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section">
        <div className="section-inner">
          <h2 className="section-title section-center reveal">Frequently asked questions</h2>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div
                key={faq.question}
                className={`faq-item reveal ${faq.open ? 'open' : ''} reveal-delay-${(i % 3) + 1}`}
                onClick={() => toggleFaq(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') toggleFaq(i);
                  if (e.key === ' ') {
                    toggleFaq(i);
                    e.preventDefault();
                  }
                }}
                tabIndex={0}
                role="button"
                aria-expanded={faq.open}
              >
                {faq.question}
                <span className="faq-plus" aria-hidden="true">+</span>
                {faq.open && <p className="faq-answer">{faq.answer}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-cta reveal">
          <h2>Take control of every subscription.<br />Start for free.</h2>
          <Link to="/auth" className="btn btn-accent btn-lg">Get Started</Link>
        </div>
        <div className="footer-main">
          <div className="footer-grid">
            <div className="footer-col footer-brand-col">
              <div className="footer-logo">
                <img src="/logo.png" alt="Prixm" className="logo-img" />
              </div>
              <p className="footer-tagline">Subscription intelligence,<br />simplified.</p>
            </div>
            <div className="footer-col">
              <h4>Platform</h4>
              <ul>
                <li><a href="#platform">Dashboard</a></li>
                <li><a href="#platform">Alerts</a></li>
                <li><a href="#platform">Analytics</a></li>
                <li><a href="#platform">Categories</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About us</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul>
                <li><a href="#faq">Help center</a></li>
                <li><a href="#">API Docs</a></li>
                <li><a href="#">System status</a></li>
                <li><a href="#">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {currentYear} Prixm. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
