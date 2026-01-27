
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TexaUser } from '../services/firebase';
import { useTheme } from '../services/ThemeContext';
import {
  DEFAULT_HEADER_SETTINGS,
  HeaderNavItem,
  HeaderSettings,
  subscribeToHeaderSettings
} from '../services/headerService';

interface NavbarProps {
  user: TexaUser | null;
  onLogout: () => void;
}

const GridIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
);

const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const ArrowRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </svg>
);

const SunIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
  </svg>
);

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0116 0" />
  </svg>
);

const CartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="9" cy="20" r="1" />
    <circle cx="17" cy="20" r="1" />
    <path d="M3 3h2l2.4 12.2a2 2 0 002 1.6h8.8a2 2 0 002-1.6L21 7H6" />
  </svg>
);

const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M6 6l12 12M18 6l-12 12" />
  </svg>
);

const PhoneIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M22 16.92V21a2 2 0 01-2.18 2A19.8 19.8 0 013 5.18 2 2 0 015 3h4.09a2 2 0 012 1.72c.12.9.32 1.77.6 2.6a2 2 0 01-.45 2.11L9.91 10.09a16 16 0 006 6l.66-1.33a2 2 0 012.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0122 16.92z" />
  </svg>
);

const MailIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const MapPinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

const StarBorder: React.FC<{
  className?: string;
  color: string;
  speed?: string;
  thickness?: number;
  children: React.ReactNode;
}> = ({ className, color, speed = '6s', thickness = 1, children }) => (
  <div
    className={`star-border-container ${className || ''}`}
    style={{ padding: `${thickness}px 0` }}
  >
    <div
      className="border-gradient-bottom"
      style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
    />
    <div
      className="border-gradient-top"
      style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }}
    />
    <div className="inner-content">{children}</div>
  </div>
);

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = theme === 'dark';
  const [headerSettings, setHeaderSettings] = useState<HeaderSettings>(DEFAULT_HEADER_SETTINGS);

  const navItems = useMemo(() => {
    const items = headerSettings.navItems || [];
    return items.filter((item) => item && item.label && item.isActive !== false);
  }, [headerSettings.navItems]);

  useEffect(() => {
    const unsubscribe = subscribeToHeaderSettings((settings) => {
      setHeaderSettings(settings);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (active < navItems.length) return;
    setActive(0);
  }, [active, navItems.length]);

  const handleNavClick = (item: HeaderNavItem | undefined, idx: number) => {
    setActive(idx);
    if (!item?.actionValue) return;
    if (item.actionType === 'route') {
      navigate(item.actionValue);
      return;
    }
    const newWin = window.open(item.actionValue, '_blank', 'noopener,noreferrer');
    if (newWin) newWin.opener = null;
  };

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-4">
      <div className="mx-auto w-full max-w-6xl glass glass-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="logo-wrap" aria-hidden="true">
              <img
                className="logo-img"
                alt={`${headerSettings.brandName || 'Logo'} Logo`}
                src={headerSettings.logoUrl || DEFAULT_HEADER_SETTINGS.logoUrl}
              />
            </div>
            <div className="leading-tight">
              <StarBorder
                className="brand-frame"
                color={isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.38)'}
                speed="6s"
                thickness={1}
              >
                <div className="brand-text title-text">{headerSettings.brandName || DEFAULT_HEADER_SETTINGS.brandName}</div>
              </StarBorder>
              <div className="text-xs muted">{headerSettings.tagline || DEFAULT_HEADER_SETTINGS.tagline}</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2 pl-1">
            <button type="button" className="icon-btn ring-focus" aria-label="Open catalog">
              <GridIcon className="h-5 w-5 title-text" />
            </button>
          </div>

          <div className="flex-1 px-1">
            <div className="field rounded-full">
              <SearchIcon className="h-4 w-4 muted" />
              <input placeholder="Search" />
              <button type="button" className="chip ring-focus" aria-label="Search" style={{ padding: '0.35rem 0.6rem' }}>
                <ArrowRightIcon className="h-4 w-4 title-text" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="chip ring-focus" onClick={toggleTheme} aria-label="Toggle theme">
              {isDark ? <MoonIcon className="h-4 w-4 title-text" /> : <SunIcon className="h-4 w-4 title-text" />}
              <span className="hidden sm:inline text-sm title-text">{isDark ? 'Dark' : 'Light'}</span>
            </button>

            <Link
              to={user ? '/profile' : '/login'}
              className="icon-btn ring-focus overflow-hidden"
              aria-label={user ? 'Account' : 'Login'}
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : user ? (
                <span className="text-xs font-bold title-text">{user.name[0].toUpperCase()}</span>
              ) : (
                <UserIcon className="h-5 w-5 title-text" />
              )}
            </Link>

            <button type="button" className="icon-btn ring-focus" aria-label="Cart">
              <CartIcon className="h-5 w-5 title-text" />
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="icon-btn ring-focus md:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <CloseIcon className="h-5 w-5 title-text" /> : <MenuIcon className="h-5 w-5 title-text" />}
            </button>
          </div>
        </div>

        <div className="glass-divider" />

        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((item, idx) => (
              <button
                key={item.id || `${item.label}-${idx}`}
                type="button"
                onClick={() => handleNavClick(item, idx)}
                className={`relative text-sm transition ring-focus rounded-full px-2 py-1 ${idx === active ? 'title-text' : 'muted hover:opacity-90'}`}
                style={
                  idx === active
                    ? { background: 'rgba(var(--accent),0.12)', border: '1px solid rgba(var(--accent),0.22)' }
                    : { border: '1px solid transparent' }
                }
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-5 text-xs">
            {!!headerSettings.contact?.phone && (
              <div className="inline-flex items-center gap-2 muted">
                <PhoneIcon className="h-4 w-4" />
                <span>{headerSettings.contact.phone}</span>
              </div>
            )}
            {!!headerSettings.contact?.email && (
              <div className="inline-flex items-center gap-2 muted">
                <MailIcon className="h-4 w-4" />
                <span>{headerSettings.contact.email}</span>
              </div>
            )}
            {!!headerSettings.contact?.location && (
              <div className="inline-flex items-center gap-2 muted">
                <MapPinIcon className="h-4 w-4" />
                <span>{headerSettings.contact.location}</span>
              </div>
            )}
          </div>

          <div className="md:hidden text-xs muted">{navItems[active]?.label || ''}</div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-3">
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((item, idx) => (
                <button
                  key={item.id || `${item.label}-${idx}`}
                  type="button"
                  onClick={() => {
                    handleNavClick(item, idx);
                    setMobileOpen(false);
                  }}
                  className={`glass glass-sm rounded-xl px-3 py-2 text-sm text-left ring-focus ${idx === active ? 'btn-glow' : ''}`}
                  style={idx === active ? { borderColor: 'rgba(var(--accent),0.28)' } : undefined}
                >
                  <span className="title-text">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-3 grid gap-2 text-xs muted">
              {!!headerSettings.contact?.phone && (
                <div className="inline-flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4" />
                  <span>{headerSettings.contact.phone}</span>
                </div>
              )}
              {!!headerSettings.contact?.email && (
                <div className="inline-flex items-center gap-2">
                  <MailIcon className="h-4 w-4" />
                  <span>{headerSettings.contact.email}</span>
                </div>
              )}
              {!!headerSettings.contact?.location && (
                <div className="inline-flex items-center gap-2">
                  <MapPinIcon className="h-4 w-4" />
                  <span>{headerSettings.contact.location}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
