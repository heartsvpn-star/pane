import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { getNavItems } from '@/config/navigation';
import { Sun, Moon, Monitor, Check, LogOut, ShieldCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/config/version';
import type { UserRole } from '@/types';

const themeOptions = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

export default function Header({ onMobileMenuOpen }: { onMobileMenuOpen: () => void }) {
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [themeOpen, setThemeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const role: UserRole = user?.role || 'user';
  const RoleIcon = role === 'admin' ? ShieldCheck : Shield;
  const navItems = getNavItems(hasPermission);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const ThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const initial = user?.username?.[0]?.toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="flex items-center justify-between h-14 px-3 sm:px-5 lg:px-6 gap-3">
        {/* Left: burger + logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onMobileMenuOpen}
            className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-background text-foreground hover:bg-accent transition-colors"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <NavLink to="/" className="flex items-center gap-2.5 group">
            <img
              src="/favicon.svg"
              alt="Aether"
              className="h-8 w-8 rounded-xl shadow-md shadow-primary/20 group-hover:scale-105 transition-transform"
            />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight text-foreground">Aether</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{APP_VERSION}</span>
            </div>
          </NavLink>
        </div>

        {/* Center: horizontal nav (desktop) */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-3xl mx-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: theme + user */}
        <div className="flex items-center gap-2 shrink-0">
          <div ref={themeRef} className="relative">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-background text-foreground hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            {themeOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => { setTheme(option.value); setThemeOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{option.label}</span>
                      {isActive && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div ref={userRef} className="relative">
            <button
              onClick={() => setUserOpen(!userOpen)}
              className="inline-flex items-center gap-2 h-9 rounded-xl px-2 border border-border bg-background text-foreground hover:bg-accent transition-colors"
            >
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                {initial}
              </div>
              <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">{user?.username || 'User'}</span>
            </button>
            {userOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-medium">{user?.username || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <RoleIcon className={`h-3 w-3 ${role === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs ${role === 'admin' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {role === 'admin' ? 'Administrator' : 'User'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-accent transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
