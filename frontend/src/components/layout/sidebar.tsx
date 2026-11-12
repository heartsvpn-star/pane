import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { getNavItems } from '@/config/navigation';
import { LogOut, ShieldCheck, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/config/version';
import type { UserRole } from '@/types';

const RoleBadge = ({ role }: { role: UserRole }) => {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
        <ShieldCheck className="h-3 w-3" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
      <Shield className="h-3 w-3" /> User
    </span>
  );
};

export default function Sidebar() {
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const role = user?.role || 'user';
  const navItems = getNavItems(hasPermission);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initial = user?.username?.[0]?.toUpperCase() || 'U';

  return (
    <div className="flex flex-col w-[72px] xl:w-[220px] h-full bg-sidebar border-r border-sidebar-border transition-all">
      {/* Logo only on narrow, full on xl */}
      <div className="flex items-center justify-center xl:justify-start xl:gap-3 px-3 xl:px-4 h-16 shrink-0">
        <img src="/favicon.svg" alt="Aether" className="h-9 w-9 shrink-0 rounded-xl shadow-md shadow-primary/25" />
        <div className="hidden xl:flex flex-col min-w-0">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate">Aether</span>
          <span className="text-[10px] text-sidebar-muted-foreground uppercase tracking-wider">{APP_VERSION}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center xl:justify-start gap-3 rounded-xl px-0 xl:px-3 h-11 xl:h-10 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="hidden xl:inline truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-2 shrink-0 border-t border-sidebar-border">
        <div className="flex items-center justify-center xl:justify-start gap-2.5 rounded-xl bg-sidebar-accent/40 px-2 xl:px-2.5 py-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initial}
          </div>
          <div className="hidden xl:block flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.username || 'User'}</p>
            <RoleBadge role={role} />
          </div>
          <button
            onClick={handleLogout}
            className="hidden xl:flex text-sidebar-muted-foreground hover:text-destructive transition-colors p-1 rounded-md"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
