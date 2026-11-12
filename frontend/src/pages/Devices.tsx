import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevicesStore } from '@/store/devices';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Smartphone, Trash2, RefreshCw, Search, MapPin, Clock,
  UserPlus, UserMinus, AlertCircle, Wifi, WifiOff, Activity,
} from 'lucide-react';
import { clientsApi, usersApi } from '@/services/api';
import type { UserItem } from '@/types';
import { useConfirm } from '@/components/ConfirmDialog';
import { getCountryFlag, formatDate } from '@/lib/utils';

export default function DevicesPage() {
  const { onlineClients, offlineClients, isLoading, error: storeLoadError, fetchDashboard, deleteDevice } = useDevicesStore();
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'online' | 'offline' | 'all'>('all');
  const [assignDialog, setAssignDialog] = useState<{ clientId: string; currentOwnerId: string | null } | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => fetchDashboard(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  useEffect(() => {
    if (hasPermission('users:manage')) {
      usersApi.getAll().then(res => {
        if (res.data.success) setUsers(res.data.data.filter((u: UserItem) => u.role === 'user'));
      }).catch(() => {});
    }
  }, [hasPermission]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Device',
      description: 'Are you sure you want to delete this device? All associated data will be removed.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setDeleting(id);
    setActionError(null);
    const success = await deleteDevice(id);
    if (!success) setActionError('Delete failed. Device may already be removed.');
    setDeleting(null);
  };

  const openAssignDialog = async (clientId: string, currentOwnerId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignError(null);
    try {
      const res = await usersApi.getAll();
      if (res.data.success) {
        setUsers(res.data.data.filter((u: UserItem) => u.role === 'user'));
        setSelectedUserId(currentOwnerId || '');
        setAssignDialog({ clientId, currentOwnerId });
      }
    } catch {}
  };

  const handleAssign = async () => {
    if (!assignDialog || !selectedUserId) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await clientsApi.assign(assignDialog.clientId, selectedUserId);
      setAssignDialog(null);
      fetchDashboard();
    } catch (err: any) {
      setAssignError(err?.response?.data?.error || 'Failed to assign device');
    }
    setAssigning(false);
  };

  const handleUnassign = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError(null);
    try {
      await clientsApi.unassign(clientId);
      fetchDashboard();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || 'Failed to unassign device');
    }
  };

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return null;
    const u = users.find(u => u.id === ownerId);
    return u ? u.username : null;
  };

  const allDevices = [...onlineClients, ...offlineClients];

  const filteredDevices = allDevices.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        d.id.toLowerCase().includes(q) ||
        (d.deviceModel || '').toLowerCase().includes(q) ||
        (d.deviceBrand || '').toLowerCase().includes(q) ||
        (d.ip || '').toLowerCase().includes(q) ||
        (d.city || '').toLowerCase().includes(q) ||
        (d.country || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const displayedDevices = filteredDevices.filter((d) => {
    if (tab === 'online') return d.online;
    if (tab === 'offline') return !d.online;
    return true;
  });

  const onlineCount = onlineClients.length;
  const offlineCount = offlineClients.length;
  const totalCount = allDevices.length;

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Devices</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Connected endpoints and their status
            </p>
          </div>
          <Button
            onClick={() => fetchDashboard()}
            variant="outline"
            disabled={isLoading}
            className="self-start rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Mini stats */}
        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => setTab('all')}
            className={`rounded-xl border p-3 text-left transition-all ${
              tab === 'all'
                ? 'border-primary/40 bg-primary/10'
                : 'border-border/50 bg-background/40 hover:border-border'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">All</p>
            <p className="text-2xl font-bold mt-0.5">{totalCount}</p>
          </button>
          <button
            onClick={() => setTab('online')}
            className={`rounded-xl border p-3 text-left transition-all ${
              tab === 'online'
                ? 'border-success/40 bg-success/10'
                : 'border-border/50 bg-background/40 hover:border-border'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Wifi className="h-3 w-3 text-success" /> Online
            </p>
            <p className="text-2xl font-bold mt-0.5 text-success">{onlineCount}</p>
          </button>
          <button
            onClick={() => setTab('offline')}
            className={`rounded-xl border p-3 text-left transition-all ${
              tab === 'offline'
                ? 'border-warning/40 bg-warning/10'
                : 'border-border/50 bg-background/40 hover:border-border'
            }`}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <WifiOff className="h-3 w-3 text-warning" /> Offline
            </p>
            <p className="text-2xl font-bold mt-0.5 text-warning">{offlineCount}</p>
          </button>
        </div>
      </div>

      {(storeLoadError || actionError) && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError || storeLoadError}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => { setActionError(null); fetchDashboard(); }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by model, IP, city, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card border-border/60"
        />
      </div>

      {/* Device grid */}
      {displayedDevices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 py-20 px-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Smartphone className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="font-semibold text-foreground">
            {search ? 'No devices match your search' : 'No devices yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            {search
              ? 'Try a different search term'
              : 'Build an APK and install it on a device — it will show up here when connected'}
          </p>
          {!search && hasPermission('builder:access') && (
            <Button
              className="mt-5 rounded-xl"
              onClick={() => navigate('/builder')}
            >
              Open Builder
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayedDevices.map((client) => {
            const isOnline = !!client.online;
            const ownerName = getOwnerName(client.ownerId ?? null);
            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/device/${client.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/device/${client.id}`);
                  }
                }}
                className="group relative rounded-2xl border border-border/60 bg-card hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer overflow-hidden"
              >
                {/* Status accent bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isOnline ? 'bg-success' : 'bg-muted-foreground/30'
                  }`}
                />

                <div className="p-4 pl-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                          isOnline ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {client.deviceBrand || client.deviceModel
                            ? `${client.deviceBrand || ''} ${client.deviceModel || ''}`.trim()
                            : 'Unknown device'}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          {client.id.slice(0, 12)}…
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
                        isOnline
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                        }`}
                      />
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {getCountryFlag(client.country)} {client.city || client.country || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(client.lastSeen)}
                    </span>
                    {client.ip && (
                      <span className="flex items-center gap-1 font-mono">
                        <Activity className="h-3 w-3" />
                        {client.ip}
                      </span>
                    )}
                    {ownerName && (
                      <span className="text-primary/80">@{ownerName}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {hasPermission('users:manage') && (
                      <>
                        <button
                          onClick={(e) => openAssignDialog(client.id, client.ownerId ?? null, e)}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Assign"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Assign
                        </button>
                        {client.ownerId && (
                          <button
                            onClick={(e) => handleUnassign(client.id, e)}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Unassign"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Unassign
                          </button>
                        )}
                      </>
                    )}
                    {hasPermission('device:delete') && (
                      <button
                        onClick={(e) => handleDelete(client.id, e)}
                        disabled={deleting === client.id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-auto"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleting === client.id ? '…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assignDialog && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAssignDialog(null)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-2xl max-w-sm w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">Assign Device</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Select a user to assign this device to. They will be the only one who can see and manage it.
            </p>
            {assignError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {assignError}
              </div>
            )}
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm"
            >
              <option value="">Select a user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setAssignDialog(null)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleAssign} disabled={!selectedUserId || assigning}>
                {assigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
