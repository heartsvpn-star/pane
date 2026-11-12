import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  role: string;
  body: string;
  createdAt: string;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ChatPage() {
  const { user, hasPermission } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canDelete = hasPermission('chat:delete') || user?.role === 'admin';

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const loadMessages = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const res = await axios.get('/api/chat/messages', { params: { limit: 150 } });
      if (res.data?.success) {
        setMessages(res.data.data || []);
        if (!silent) setTimeout(scrollToBottom, 50);
      }
    } catch (e: any) {
      if (!silent) setError(e?.response?.data?.error || 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    loadMessages();
    const t = setInterval(() => loadMessages(true), 3000);
    return () => clearInterval(t);
  }, [loadMessages]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await axios.post('/api/chat/messages', { body });
      if (res.data?.success && res.data.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.data.id)) return prev;
          return [...prev, res.data.data];
        });
        setText('');
        setTimeout(scrollToBottom, 30);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: number) => {
    if (!canDelete) return;
    try {
      await axios.delete(`/api/chat/messages/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[420px]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Panel Chat</h1>
            <p className="text-xs text-muted-foreground">Shared room for all panel users</p>
          </div>
        </div>
        {canDelete && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border/60 rounded-full px-2 py-0.5">
            Admin can delete
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-2xl border border-border/50 bg-card/40 p-3 sm:p-4 space-y-3">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-16">
            <img src="/favicon.svg" alt="" className="h-12 w-12 opacity-80 mb-1" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground">Be the first to say hello.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user?.id;
            const isAdminMsg = m.role === 'admin';
            return (
              <div
                key={m.id}
                className={cn(
                  'group flex gap-2.5 max-w-[92%] sm:max-w-[75%]',
                  mine ? 'ml-auto flex-row-reverse' : ''
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    isAdminMsg
                      ? 'bg-gradient-to-br from-violet-500 to-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {(m.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={cn('min-w-0', mine ? 'text-right' : '')}>
                  <div className={cn('flex items-center gap-1.5 mb-0.5', mine ? 'justify-end' : '')}>
                    <span className="text-xs font-semibold text-foreground/90">{m.username}</span>
                    {isAdminMsg && <ShieldCheck className="h-3 w-3 text-primary" />}
                    <span className="text-[10px] text-muted-foreground">{formatTime(m.createdAt)}</span>
                  </div>
                  <div
                    className={cn(
                      'inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words text-left',
                      mine
                        ? 'bg-primary text-primary-foreground rounded-tr-md'
                        : 'bg-secondary/80 text-secondary-foreground rounded-tl-md border border-border/40'
                    )}
                  >
                    {m.body}
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[10px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          disabled={sending}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" disabled={sending || !text.trim()} className="shrink-0 gap-1.5">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
      </form>
    </div>
  );
}
