import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { clientsApi } from '@/services/api';
import type { ClientDevice, DeviceOutletContext } from '@/types';
import { useAuthStore } from '@/store/auth';
import { useDevicesStore } from '@/store/devices';
import { getDeviceTabs } from '@/config/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Smartphone, RefreshCw, Trash2, AlertCircle, Download, Loader2 } from 'lucide-react';
import { cn, getCountryFlag } from '@/lib/utils';

export default function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const desktopTabBarRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuthStore();
  const deleteDeviceFromStore = useDevicesStore((s) => s.deleteDevice);
  const deviceTabs = getDeviceTabs(hasPermission);
  const [client, setClient] = useState<ClientDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !client) return;
    const el = desktopTabBarRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [id, loading, client]);

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientsApi.getOne(id);
      if (res.data.success) {
        setClient(res.data.data);
      } else {
        setError('Device not found');
      }
    } catch {
      setError('Failed to load device. It may not exist or server is unreachable.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!id) return;
    setExporting(true);
    setActionError(null);
    try {
      const { fetchAuthBlob } = await import('@/services/api');
      const blob = await fetchAuthBlob(`/api/client/${id}/export`);
      if (!blob) throw new Error('Export failed');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aether-data-${id}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to export device data');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setActionError(null);
    try {
      const ok = await deleteDeviceFromStore(id);
      if (ok) {
        navigate('/devices');
      } else {
        setActionError('Delete failed. Device may already be removed.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete device');
    }
    setShowDeleteConfirm(false);
  };

  if (loading && !client) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h3 className="text-lg font-semibold">Device Not Found</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={loadClient} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
            <Button onClick={() => navigate('/devices')} variant="outline">
              ← Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Device hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative px-4 sm:px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/devices')}
              className="shrink-0 h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
            >
              ←
            </Button>
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                client?.online ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold truncate">
                  {client?.deviceBrand ? `${client.deviceBrand} ` : ''}
                  {client?.deviceModel || 'Unknown Device'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    client?.online
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      client?.online ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                    }`}
                  />
                  {client?.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono truncate max-w-[120px]" title={id}>
                  {id?.substring(0, 12)}…
                </span>
                <span>·</span>
                <span>
                  {getCountryFlag(client?.country ?? null)}{' '}
                  {client?.city || client?.country || client?.ip || 'Unknown'}
                </span>
                {client?.ip && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline font-mono">{client.ip}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={loadClient}
                disabled={loading}
                className="h-9 w-9 rounded-xl"
                aria-label="Refresh device"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {hasPermission('files:download') && hasPermission('device:view') && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExport}
                  disabled={exporting}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary"
                  aria-label="Download all data"
                  title="Download all data as ZIP"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              {hasPermission('device:delete') && !showDeleteConfirm && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
                  aria-label="Delete device"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {showDeleteConfirm && (
                <div className="flex items-center gap-1">
                  <Button variant="destructive" size="sm" onClick={handleDelete} className="h-8 text-xs px-2.5 rounded-lg">
                    Confirm
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="h-8 text-xs px-2.5 rounded-lg">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs — pill style */}
        <div className="relative px-3 sm:px-4 pb-3">
          <div
            ref={desktopTabBarRef}
            className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5"
          >
            {deviceTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={`/device/${id}/${tab.to}`}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )
                }
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {!client?.online && (
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Device Offline</span>
          <span className="text-warning/70">Some features are unavailable while offline.</span>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {actionError}
          <button onClick={() => setActionError(null)} className="ml-auto text-xs hover:text-destructive/80">
            Dismiss
          </button>
        </div>
      )}

      <div className="pt-1">
        <Outlet
          context={
            {
              client,
              clientId: id ?? '',
              loadClient,
              online: !!client?.online,
            } satisfies DeviceOutletContext
          }
        />
      </div>
    </div>
  );
}
