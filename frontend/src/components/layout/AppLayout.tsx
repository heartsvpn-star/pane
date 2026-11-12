import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './header';
import MobileNav from './mobile-nav';
import { useDevicesStore } from '@/store/devices';
import { initAdminSocket, disconnectAdminSocket } from '@/services/socket';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const fetchDashboard = useDevicesStore((s) => s.fetchDashboard);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const fetchDashboardRef = useRef(fetchDashboard);
  useEffect(() => {
    fetchDashboardRef.current = fetchDashboard;
  });

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleDeviceChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDashboardRef.current();
      }, 2000);
    };
    initAdminSocket(handleDeviceChange);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      disconnectAdminSocket();
    };
  }, []);

  const widePaths = ['/', '/devices', '/device', '/users', '/logs'];
  const isWide = widePaths.some((p) =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <Header onMobileMenuOpen={() => setMobileOpen(true)} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20">
        <div
          className={
            isWide
              ? 'p-3 sm:p-5 lg:p-6 max-w-6xl mx-auto w-full'
              : 'p-3 sm:p-5 lg:p-8 max-w-3xl mx-auto w-full'
          }
        >
          <Outlet />
        </div>
      </main>

      <div className="footer-line shrink-0" />
      <footer className="shrink-0 bg-background/80 px-4 py-2.5">
        <div className="flex items-center justify-between max-w-6xl mx-auto gap-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-4 w-4 opacity-80" />
            <span className="text-[11px] font-semibold tracking-wide text-foreground/70">Aether</span>
          </div>
          <span className="footer-credit">
            Made by{' '}
            <span className="footer-name footer-name-shine">Aether Group</span>
          </span>
        </div>
      </footer>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  );
}
