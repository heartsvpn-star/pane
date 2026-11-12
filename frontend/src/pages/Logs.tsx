import { useEffect, useRef, useState } from 'react';
import { logsApi } from '@/services/api';
import type { LogEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText, RefreshCw, Trash2, Search, AlertCircle, Activity,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useConfirm } from '@/components/ConfirmDialog';
import { useAuthStore } from '@/store/auth';

const logTypes = ['ALL', 'INFO', 'SUCCESS', 'ERROR', 'WARNING', 'CONNECTION', 'DISCONNECTION', 'COMMAND', 'DATA', 'AUTH'];
const logCategories = ['ALL', 'SYSTEM', 'CLIENT', 'SOCKET', 'QUEUE', 'HTTP', 'BUILD', 'SECURITY'];

const typeColor: Record<string, string> = {
  ERROR: 'text-destructive bg-destructive/10 border-destructive/20',
  WARNING: 'text-warning bg-warning/10 border-warning/20',
  SUCCESS: 'text-success bg-success/10 border-success/20',
  INFO: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  CONNECTION: 'text-success bg-success/10 border-success/20',
  DISCONNECTION: 'text-muted-foreground bg-muted border-border',
  COMMAND: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  DATA: 'text-primary bg-primary/10 border-primary/20',
  AUTH: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { hasPermission } = useAuthStore();
  const canClearLogs = hasPermission('logs:clear');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadLogs = async (opts?: { type?: string; category?: string; search?: string }) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await logsApi.getLogs({
        type: (opts?.type || typeFilter) !== 'ALL' ? (opts?.type || typeFilter) : undefined,
        category: (opts?.category || categoryFilter) !== 'ALL' ? (opts?.category || categoryFilter) : undefined,
        search: (opts?.search || search) || undefined,
        limit: 500,
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (res.data.success) setLogs(res.data.data || []);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setFetchError(err?.response?.data?.error || 'Failed to load logs');
    }
    if (!controller.signal.aborted) setLoading(false);
  };

  useEffect(() => {
    loadLogs();
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleSearch = () => {
    setSearch(searchInput);
    loadLogs({ search: searchInput });
  };

  const handleType = (t: string) => {
    setTypeFilter(t);
    loadLogs({ type: t });
  };

  const handleCategory = (c: string) => {
    setCategoryFilter(c);
    loadLogs({ category: c });
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Clear Logs',
      description: 'Delete all log entries? This cannot be undone.',
      confirmLabel: 'Clear',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await logsApi.clear();
      setLogs([]);
    } catch {}
  };

  const errorCount = logs.filter((l) => (l.type || '').toUpperCase() === 'ERROR').length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-card to-card p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-9 w-9 rounded-xl bg-sky-500/15 flex items-center justify-center">
                <FileText className="h-5 w-5 text-sky-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Logs</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">System events and activity stream</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button onClick={() => loadLogs()} variant="outline" size="sm" className="rounded-xl" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {canClearLogs && (
              <Button onClick={handleClear} variant="outline" size="sm" className="rounded-xl text-destructive hover:text-destructive gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Entries</p>
            <p className="text-2xl font-bold mt-0.5">{logs.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" /> Errors
            </p>
            <p className="text-2xl font-bold mt-0.5 text-destructive">{errorCount}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3 text-primary" /> Filter
            </p>
            <p className="text-sm font-semibold mt-1 truncate">
              {typeFilter === 'ALL' && categoryFilter === 'ALL' ? 'All' : `${typeFilter} / ${categoryFilter}`}
            </p>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 h-11 rounded-xl bg-card border-border/60"
            />
          </div>
          <Button onClick={handleSearch} className="h-11 rounded-xl px-5">Search</Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {logTypes.map((t) => (
            <button
              key={t}
              onClick={() => handleType(t)}
              className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-full border transition-colors ${
                typeFilter === t
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {logCategories.map((c) => (
            <button
              key={c}
              onClick={() => handleCategory(c)}
              className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                categoryFilter === c
                  ? 'border-sky-400/50 bg-sky-400/10 text-sky-400'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Log stream */}
      {logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 py-20 px-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="font-semibold">No logs found</p>
          <p className="text-sm text-muted-foreground mt-1.5">Events will appear here as the system runs</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/40">
            {logs.map((log, i) => {
              const t = (log.type || 'INFO').toUpperCase();
              const colors = typeColor[t] || 'text-muted-foreground bg-muted border-border';
              return (
                <div key={log.id || i} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors}`}>
                      {t}
                    </span>
                    {log.category && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {log.category}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto font-mono">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                  <p className="text-sm break-words">{log.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
