import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { getNavItems } from '@/config/navigation';
import { LogOut, X, ShieldCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/config/version';
import type { UserRole } from '@/types';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileNav({ open, onClose }: MobileNavProps) {
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role || 'user' as UserRole;
  const navItems = getNavItems(hasPermission);

  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; } else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleLogout = async () => { await logout(); onClose(); navigate('/login'); };
  const handleNavClick = () => { onClose(); };
  const initial = user?.username?.[0]?.toUpperCase() || 'U';
  const RoleIcon = role === 'admin' ? ShieldCheck : Shield;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sidebar border-r border-sidebar-border shadow-2xl flex flex-col">
        <div className="relative flex items-center justify-between px-4 h-16 shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <img src="/favicon.svg" alt="Aether" className="h-9 w-9 shrink-0 drop-shadow-[0_0_10px_rgba(216,219,227,0.25)]" />
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-sidebar-foreground leading-tight">Aether</span>
              <span className="text-[10px] text-sidebar-muted-foreground leading-tight font-medium tracking-wide uppercase">{APP_VERSION}</span>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors p-1.5 rounded-lg hover:bg-sidebar-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          <p className="px-3 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground">Navigation</p>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20'
                      : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="mx-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

        <div className="p-3 shrink-0 space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/50 px-3 py-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.username || 'User'}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${role === 'admin' ? 'text-primary' : 'text-muted-foreground'}`}>
                <RoleIcon className="h-3 w-3" />
                {role === 'admin' ? 'Admin' : 'User'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sidebar-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="pt-1 pb-0.5 text-center">
            <p className="footer-credit text-[10px]">
              Made by <span className="footer-name footer-name-shine">Aether Group</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
