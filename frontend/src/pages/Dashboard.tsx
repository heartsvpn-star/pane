import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevicesStore } from '@/store/devices';
import { useAuthStore } from '@/store/auth';
import { getQuickActions } from '@/config/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorAlert } from '@/components/device/shared';
import {
  Users, Wifi, WifiOff, Clock, RefreshCw,
  Activity, Zap, Smartphone, ArrowRight,
  ShieldCheck, UserCog, Server,
} from 'lucide-react';
import { formatTime } from '@/lib/utils';

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/40 overflow-hidden ${className || ''}`}>
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-8" />
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-3 w-12" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { stats, isLoading, error, fetchDashboard } = useDevicesStore();
  const { user, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSyncing(true);
      await fetchDashboard();
      if (!cancelled) {
        setHasLoadedOnce(true);
        setSyncing(false);
      }
    })();
    const interval = setInterval(() => fetchDashboard(true), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchDashboard]);

  const handleSync = async () => {
    setSyncing(true);
    await fetchDashboard();
    setSyncing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const online = stats?.onlineClients || 0;
  const total = stats?.totalClients || 0;
  const offline = stats?.offlineClients || 0;
  const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;
  const quickActions = getQuickActions(hasPermission);
  const showSkeleton = isLoading && !hasLoadedOnce;

  return (
    <div className="space-y-5 relative">
      {/* Live sync strip */}
      {syncing && <div className="live-sync-bar" aria-hidden />}

      {/* Brand header + greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 stagger-item" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <img
              src="/favicon.svg"
              alt="Aether"
              className="h-11 w-11 drop-shadow-[0_0_14px_rgba(216,219,227,0.28)]"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background pulse-dot text-success" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground mb-0.5">
              {getGreeting()} · {user?.username || 'Admin'}
            </p>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              Control Center
              <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 border border-border/60 rounded-full px-2 py-0.5">
                Aether
              </span>
            </h1>
          </div>
        </div>
        <Button
          onClick={handleSync}
          variant="ghost"
          size="sm"
          disabled={syncing}
          className="self-start sm:self-auto"
          title="Refresh dashboard data"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </Button>
      </div>

      {error && <ErrorAlert message={error} onRetry={handleSync} />}

      {/* Skeleton state */}
      {showSkeleton && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <SkeletonCard className="col-span-2 row-span-2 min-h-[200px]" />
          <SkeletonCard className="col-span-1" />
          <SkeletonCard className="col-span-1" />
          <SkeletonCard className="col-span-2" />
          <SkeletonCard className="col-span-1" />
          <SkeletonCard className="col-span-1" />
          <SkeletonCard className="col-span-2" />
          <SkeletonCard className="col-span-2 md:col-span-4" />
        </div>
      )}

      {/* Empty state when no devices after load */}
      {!showSkeleton && hasLoadedOnce && total === 0 && !error && (
        <div className="empty-state rounded-2xl border border-border/50 bg-card/40 stagger-item" style={{ animationDelay: '80ms' }}>
          <img src="/favicon.svg" alt="" className="h-14 w-14 mb-1" />
          <h3 className="text-base font-semibold tracking-tight">No devices yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Build an APK in the Builder and connect your first device to see live stats here.
          </p>
          {hasPermission('builder:access') && (
            <Button
              size="sm"
              className="mt-2"
              onClick={() => navigate('/builder')}
            >
              Open Builder
            </Button>
          )}
        </div>
      )}

      {/* BENTO GRID */}
      {!showSkeleton && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 auto-rows-[minmax(100px,auto)]">

          {/* BIG: Online status */}
          <Card
            className="col-span-2 row-span-2 border-0 bg-gradient-to-br from-success/20 via-success/5 to-transparent rounded-2xl overflow-hidden relative glow-success stagger-item"
            style={{ animationDelay: '60ms' }}
          >
            <CardContent className="p-5 h-full flex flex-col justify-between min-h-[200px]">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-success/20 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-success" />
                </div>
                <Badge className="bg-success/20 text-success border-0 text-[10px] gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot text-success inline-block" />
                  LIVE
                </Badge>
              </div>
              <div>
                <p className="text-5xl font-bold tracking-tighter text-success tabular-nums">{online}</p>
                <p className="text-sm text-muted-foreground mt-1 tracking-wide">devices online</p>
                <div className="mt-3 h-1.5 rounded-full bg-success/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-700 ease-out"
                    style={{ width: `${onlinePct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 tracking-wide">
                  {onlinePct}% of {total} total
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="col-span-1 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{total}</p>
                <p className="text-[11px] text-muted-foreground tracking-wide">Total</p>
              </div>
            </CardContent>
          </Card>

          {/* Offline */}
          <Card className="col-span-1 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '130ms' }}>
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <WifiOff className="h-4 w-4 text-warning" />
              <div>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{offline}</p>
                <p className="text-[11px] text-muted-foreground tracking-wide">Offline</p>
              </div>
            </CardContent>
          </Card>

          {/* Uptime */}
          <Card className="col-span-2 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '160ms' }}>
            <CardContent className="p-4 h-full flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight tabular-nums">{stats ? formatTime(stats.uptime) : '0m'}</p>
                <p className="text-[11px] text-muted-foreground tracking-wide">Server uptime</p>
              </div>
            </CardContent>
          </Card>

          {/* Users */}
          <Card className="col-span-1 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '190ms' }}>
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <UserCog className="h-4 w-4 text-sky-500" />
              <div>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats?.totalUsers || 0}</p>
                <p className="text-[11px] text-muted-foreground tracking-wide">Users</p>
              </div>
            </CardContent>
          </Card>

          {/* Admins */}
          <Card className="col-span-1 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '220ms' }}>
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <ShieldCheck className="h-4 w-4 text-violet-500" />
              <div>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{stats?.totalAdmins || 0}</p>
                <p className="text-[11px] text-muted-foreground tracking-wide">Admins</p>
              </div>
            </CardContent>
          </Card>

          {/* System */}
          <Card className="col-span-2 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '250ms' }}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">System</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-success" />
                  <span className="text-sm">Status</span>
                </div>
                <Badge className="bg-success/15 text-success border-0 text-[10px] gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot text-success inline-block" />
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">Connections</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">{online}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Memory</span>
                <span className="text-sm font-semibold tabular-nums">
                  {stats?.memoryUsage != null ? `${stats.memoryUsage} MB` : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="col-span-2 md:col-span-4 border border-border/50 rounded-2xl bg-card stagger-item" style={{ animationDelay: '280ms' }}>
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.to)}
                    title={action.label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/50 hover:bg-primary/10 hover:border-primary/30 p-3 transition-all duration-200 group hover:scale-[1.03]"
                  >
                    <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Manage devices CTA */}
          {hasPermission('device:view') && (
            <button
              onClick={() => navigate('/devices')}
              className="col-span-2 md:col-span-4 lg:col-span-6 group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-5 text-left transition-all duration-200 hover:border-primary/40 hover:from-primary/25 hover:scale-[1.01] stagger-item"
              style={{ animationDelay: '320ms' }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <Smartphone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">Open Device Manager</h3>
                    <p className="text-sm text-muted-foreground">Control all connected devices</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-primary opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shrink-0" />
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
