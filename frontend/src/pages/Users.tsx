import { useEffect, useState, useRef } from 'react';
import { usersApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import type { UserItem, UserRole, Permission } from '@/types';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, DEFAULT_USER_PERMISSIONS } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Users as UsersIcon, Plus, Trash2, Check, CheckCircle,
  AlertCircle, ShieldCheck, Shield, RefreshCw, Lock, Search, Mail, Clock, Key, Copy,
  Eye, EyeOff, Save, AlertTriangle
} from 'lucide-react';
import { formatDate, copyToClipboard } from '@/lib/utils';
import { useConfirm } from '@/components/ConfirmDialog';

interface UserDialog {
  mode: 'create' | 'edit' | 'resetPassword' | 'permissions' | 'deviceSecret';
  userId?: string;
  initialData?: Partial<UserItem>;
}

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<UserDialog | null>(null);

  const dialogRef = useRef<UserDialog | null>(null);
  dialogRef.current = dialog;
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [search, setSearch] = useState('');

  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');
  const [formPermissions, setFormPermissions] = useState<Permission[]>([]);

  const [secretValue, setSecretValue] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState('');
  const [secretVisible, setSecretVisible] = useState(false);
  const [secretSaving, setSecretSaving] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretSuccess, setSecretSuccess] = useState<string | null>(null);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const secretTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const secretDirty = secretInput !== (secretValue || '') && secretInput.trim().length > 0;

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.getAll();
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load users');
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('user');
    setFormPermissions([...DEFAULT_USER_PERMISSIONS]);
    setDialogError(null);
    setDialog({ mode: 'create' });
  };

  const openEditDialog = (user: UserItem) => {
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormRole(user.role as UserRole);
    setFormPassword('');
    setFormPermissions(user.permissions || []);
    setDialogError(null);
    setDialog({ mode: 'edit', userId: user.id, initialData: user });
  };

  const openResetPasswordDialog = (user: UserItem) => {
    setFormPassword('');
    setDialogError(null);
    setDialog({ mode: 'resetPassword', userId: user.id, initialData: user });
  };

  const openPermissionsDialog = (user: UserItem) => {
    setFormPermissions(user.permissions || []);
    setDialogError(null);
    setDialog({ mode: 'permissions', userId: user.id, initialData: user });
  };

  const openDeviceSecretDialog = async (user: UserItem) => {
    const targetUserId = user.id;
    setSecretValue(null);
    setSecretInput('');
    setSecretVisible(false);
    setSecretError(null);
    setSecretSuccess(null);
    setSecretCopied(false);
    setDialog({ mode: 'deviceSecret', userId: targetUserId, initialData: user });

    try {
      const res = await usersApi.getUserSecret(targetUserId);

      setDialog(prev => {
        if (!prev || prev.userId !== targetUserId || prev.mode !== 'deviceSecret') return prev;
        return prev;
      });

      const currentDialog = dialogRef.current;
      if (!currentDialog || currentDialog.userId !== targetUserId || currentDialog.mode !== 'deviceSecret') return;
      if (res.data.success) {
        const s = res.data.data?.deviceSecret || null;
        setSecretValue(s);
        setSecretInput(prev => prev === '' ? (s || '') : prev);
      }
    } catch {
      setSecretError('Failed to load device secret');
    }
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogError(null);
    setDialogLoading(false);
    setSecretError(null);
    setSecretSuccess(null);
  };

  const handleCopySecret = async () => {
    const val = secretInput || secretValue;
    if (!val) return;
    const ok = await copyToClipboard(val);
    if (ok) {
      setSecretCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setSecretCopied(false), 2000);
    } else {
      setSecretError('Copy failed. Select and copy manually.');
      if (secretTimerRef.current) clearTimeout(secretTimerRef.current);
      secretTimerRef.current = setTimeout(() => setSecretError(null), 4000);
    }
  };

  const handleSaveSecret = async () => {
    if (!dialog?.userId) return;
    const value = secretInput.trim();
    if (!value) { setSecretError('Secret cannot be empty'); return; }
    if (value.length < 8) { setSecretError('Secret must be at least 8 characters'); return; }
    if (/[\r\n=]/.test(value)) { setSecretError('Secret must not contain newlines or "=" characters'); return; }

    setSecretSaving(true);
    setSecretError(null);
    setSecretSuccess(null);
    try {
      const res = await usersApi.setUserSecret(dialog.userId, value);
      if (res.data.success) {
        setSecretValue(res.data.data.deviceSecret);
        setSecretInput(res.data.data.deviceSecret);
        setSecretSuccess('Secret saved. The user must rebuild their APK.');
        if (secretTimerRef.current) clearTimeout(secretTimerRef.current);
        secretTimerRef.current = setTimeout(() => setSecretSuccess(null), 6000);
      } else {
        setSecretError(res.data.error || 'Failed to save secret');
      }
    } catch (err: any) {
      setSecretError(err?.response?.data?.error || 'Failed to save secret');
    }
    setSecretSaving(false);
  };

  const handleRegenerateSecret = async () => {
    if (!dialog?.userId) return;
    setRegenDialogOpen(false);
    setSecretSaving(true);
    setSecretError(null);
    setSecretSuccess(null);
    try {
      const res = await usersApi.regenerateSecret(dialog.userId);
      if (res.data.success) {
        setSecretValue(res.data.data.deviceSecret);
        setSecretInput(res.data.data.deviceSecret);
        setSecretSuccess('Secret rotated. The user must rebuild their APK.');
        if (secretTimerRef.current) clearTimeout(secretTimerRef.current);
        secretTimerRef.current = setTimeout(() => setSecretSuccess(null), 6000);
      } else {
        setSecretError(res.data.error || 'Failed to regenerate secret');
      }
    } catch (err: any) {
      setSecretError(err?.response?.data?.error || 'Failed to regenerate secret');
    }
    setSecretSaving(false);
  };

  const togglePermission = (perm: Permission) => {
    setFormPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleCreate = async () => {
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await usersApi.create({ username: formUsername, email: formEmail, password: formPassword, role: formRole, permissions: formRole === 'user' ? formPermissions : undefined });
      if (res.data.success) {
        await fetchUsers();
        closeDialog();
        return;
      }
      setDialogError(res.data.error || 'Failed to create user');
    } catch (err: any) {
      setDialogError(err?.response?.data?.error || 'Failed to create user');
    }
    setDialogLoading(false);
  };

  const handleEdit = async () => {
    if (!dialog?.userId) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await usersApi.update(dialog.userId, { username: formUsername, email: formEmail, role: formRole, permissions: formRole === 'user' ? formPermissions : undefined });
      if (res.data.success) {
        await fetchUsers();
        closeDialog();
        return;
      }
      setDialogError(res.data.error || 'Failed to update user');
    } catch (err: any) {
      setDialogError(err?.response?.data?.error || 'Failed to update user');
    }
    setDialogLoading(false);
  };

  const handleResetPassword = async () => {
    if (!dialog?.userId) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await usersApi.resetPassword(dialog.userId, formPassword);
      if (res.data.success) {
        closeDialog();
        return;
      }
      setDialogError(res.data.error || 'Failed to reset password');
    } catch (err: any) {
      setDialogError(err?.response?.data?.error || 'Failed to reset password');
    }
    setDialogLoading(false);
  };

  const handleSavePermissions = async () => {
    if (!dialog?.userId) return;
    setDialogLoading(true);
    setDialogError(null);
    try {
      const res = await usersApi.updatePermissions(dialog.userId, formPermissions);
      if (res.data.success) {
        await fetchUsers();
        closeDialog();
        return;
      }
      setDialogError(res.data.error || 'Failed to update permissions');
    } catch (err: any) {
      setDialogError(err?.response?.data?.error || 'Failed to update permissions');
    }
    setDialogLoading(false);
  };

  const handleDelete = async (userId: string) => {
    const ok = await confirm({ title: 'Delete User', description: 'Delete this user? This is irreversible.', confirmLabel: 'Delete', variant: 'destructive' });
    if (!ok) return;
    try {
      const res = await usersApi.delete(userId);
      if (res.data.success) {
        await fetchUsers();
      } else {
        setError(res.data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete user');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();

    return (
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/10 via-card to-card p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-9 w-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <UsersIcon className="h-5 w-5 text-violet-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Users</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Accounts, roles and access control
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button onClick={fetchUsers} variant="outline" size="sm" className="rounded-xl" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={openCreateDialog} size="sm" className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" /> Add User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-2xl font-bold mt-0.5">{users.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-orange-400" /> Admins
            </p>
            <p className="text-2xl font-bold mt-0.5 text-orange-400">
              {users.filter(u => u.role === 'admin').length}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary" /> Users
            </p>
            <p className="text-2xl font-bold mt-0.5 text-primary">
              {users.filter(u => u.role !== 'admin').length}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by username, email, role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-card border-border/60"
        />
      </div>

      {/* User list */}
      {filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 py-20 px-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <UsersIcon className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <p className="font-semibold text-foreground">
            {search ? 'No users match your search' : 'No users yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            {search ? 'Try a different search term' : 'Create your first user to get started'}
          </p>
          {!search && (
            <Button className="mt-5 rounded-xl gap-2" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" /> Add User
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredUsers.map((user) => {
            const isYou = currentUser?.id === user.id;
            const isAdmin = user.role === 'admin';
            const permPct = isAdmin
              ? 100
              : ((user.permissions?.length || 0) / ALL_PERMISSIONS.length) * 100;
            return (
              <div
                key={user.id}
                className={`group relative rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-md hover:shadow-primary/5 ${
                  isYou ? 'border-primary/40' : 'border-border/60 hover:border-primary/25'
                }`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isAdmin ? 'bg-orange-500' : 'bg-primary/60'
                  }`}
                />

                <div className="p-4 pl-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Identity */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        isYou
                          ? 'bg-gradient-to-br from-primary to-violet-500 text-white'
                          : isAdmin
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {user.username[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{user.username}</p>
                        {isYou && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                            You
                          </span>
                        )}
                        {user.isDefault === 1 && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                            Primary
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            isAdmin
                              ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isAdmin ? <ShieldCheck className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                          {isAdmin ? 'Admin' : 'User'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email || 'No email'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {user.lastLogin ? formatDate(user.lastLogin) : 'Never logged in'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Permissions bar */}
                  <div className="sm:w-36 shrink-0">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Permissions</span>
                      <span>
                        {isAdmin
                          ? `All`
                          : `${user.permissions?.length || 0}/${ALL_PERMISSIONS.length}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isAdmin ? 'bg-orange-500' : 'bg-primary'}`}
                        style={{ width: `${permPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {user.isDefault !== 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-lg"
                        onClick={() => openEditDialog(user)}
                      >
                        Edit
                      </Button>
                    )}
                    {user.role !== 'admin' && user.isDefault !== 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-lg"
                        onClick={() => openPermissionsDialog(user)}
                      >
                        <Lock className="h-3 w-3 mr-1" />
                        Perms
                      </Button>
                    )}
                    {user.isDefault !== 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs rounded-lg"
                        onClick={() => openResetPasswordDialog(user)}
                      >
                        Reset
                      </Button>
                    )}
                    {user.isDefault !== 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={() => openDeviceSecretDialog(user)}
                        title="Manage device secret"
                      >
                        <Key className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {user.isDefault !== 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                        onClick={() => handleDelete(user.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !dialogLoading) closeDialog(); }}>
        <DialogContent className={dialog?.mode === 'permissions' ? 'max-w-lg' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'create' && 'Create New User'}
              {dialog?.mode === 'edit' && 'Edit User'}
              {dialog?.mode === 'resetPassword' && 'Reset Password'}
              {dialog?.mode === 'permissions' && (
                <span className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Permissions: {dialog?.initialData?.username}
                </span>
              )}
              {dialog?.mode === 'deviceSecret' && (
                <span className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Device Secret: {dialog?.initialData?.username}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === 'create' && 'Add a new user account to the system'}
              {dialog?.mode === 'edit' && 'Update user account details'}
              {dialog?.mode === 'resetPassword' && `Set a new password for ${dialog?.initialData?.username}`}
              {dialog?.mode === 'permissions' && `Toggle permissions for ${dialog?.initialData?.username}. Changes take effect after saving.`}
              {dialog?.mode === 'deviceSecret' && `Manage the device secret for ${dialog?.initialData?.username}. Embedded in APKs they build.`}
            </DialogDescription>
          </DialogHeader>

          <div className={`${dialog?.mode === 'permissions' ? 'max-h-[60vh] overflow-y-auto' : ''} space-y-4 py-2`}>
            {dialogError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {dialogError}
              </div>
            )}

            {dialog?.mode === 'resetPassword' ? (
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="Enter new password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                />
              </div>
            ) : dialog?.mode === 'permissions' ? (
              <div className="space-y-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <h4 className="text-sm font-semibold mb-2">{group.label}</h4>
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {group.permissions.map((perm) => {
                        const isEnabled = formPermissions.includes(perm.key);
                        return (
                          <div key={perm.key} className="flex items-center justify-between py-2.5 px-3">
                            <div className="min-w-0 mr-3">
                              <p className="text-sm font-medium">{perm.label}</p>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePermission(perm.key)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                                isEnabled ? 'bg-primary' : 'bg-muted'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                                  isEnabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : dialog?.mode === 'deviceSecret' ? (
              <div className="space-y-4">
                {secretError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {secretError}
                  </div>
                )}
                {secretSuccess && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{secretSuccess}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="user-secret">Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      id="user-secret"
                      type={secretVisible ? 'text' : 'password'}
                      value={secretInput}
                      placeholder={secretValue ? '' : 'Type a secret or click Generate'}
                      onChange={(e) => { setSecretInput(e.target.value); setSecretError(null); setSecretSuccess(null); }}
                      className="font-mono text-sm"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSecretVisible(!secretVisible)}
                      disabled={secretSaving || !secretInput}
                      title={secretVisible ? 'Hide secret' : 'Show secret'}
                      aria-label={secretVisible ? 'Hide secret' : 'Show secret'}
                      className="shrink-0"
                    >
                      {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopySecret}
                      disabled={secretSaving || !secretInput}
                      title={secretCopied ? 'Copied!' : 'Copy to clipboard'}
                      aria-label="Copy to clipboard"
                      className="shrink-0"
                    >
                      {secretCopied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {secretValue
                      ? 'Edit the field and Save, or click Regenerate for a random one. Min 8 chars.'
                      : 'Type a secret (min 8 chars) and Save, or click Generate for a random one.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveSecret}
                    disabled={secretSaving || !secretDirty}
                    className="gap-2"
                  >
                    {secretSaving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Secret</>}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRegenDialogOpen(true)}
                    disabled={secretSaving}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {secretValue ? 'Regenerate' : 'Generate'}
                  </Button>
                  {secretDirty && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setSecretInput(secretValue || ''); setSecretError(null); setSecretSuccess(null); }}
                      disabled={secretSaving}
                      className="gap-2"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="form-username">Username</Label>
                  <Input
                    id="form-username"
                    type="text"
                    placeholder="Enter username"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-email">Email</Label>
                  <Input
                    id="form-email"
                    type="email"
                    placeholder="Enter email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
                {dialog?.mode === 'create' && (
                  <div className="space-y-2">
                    <Label htmlFor="form-password">Password</Label>
                    <Input
                      id="form-password"
                      type="password"
                      placeholder="Enter password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formRole === 'admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setFormRole('admin'); setFormPermissions([...ALL_PERMISSIONS]); }}
                      className="gap-1"
                    >
                      <ShieldCheck className="h-3 w-3" /> Admin
                    </Button>
                    <Button
                      type="button"
                      variant={formRole === 'user' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setFormRole('user'); setFormPermissions([...DEFAULT_USER_PERMISSIONS]); }}
                      className="gap-1"
                    >
                      <Shield className="h-3 w-3" /> User
                    </Button>
                  </div>
                  {formRole === 'admin' && (
                    <p className="text-xs text-muted-foreground">Admin users have all permissions automatically.</p>
                  )}
                  {formRole === 'user' && (
                    <p className="text-xs text-muted-foreground">User permissions can be customized after creation.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {dialog?.mode !== 'deviceSecret' && (
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={closeDialog}>Cancel</Button>
            <Button
              size="sm"
              onClick={
                dialog?.mode === 'create' ? handleCreate :
                dialog?.mode === 'edit' ? handleEdit :
                dialog?.mode === 'permissions' ? handleSavePermissions :
                handleResetPassword
              }
              disabled={dialogLoading}
              className="gap-1.5"
            >
              {dialogLoading ? (
                'Saving...'
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {dialog?.mode === 'create' ? 'Create' : dialog?.mode === 'edit' ? 'Save' : dialog?.mode === 'permissions' ? 'Save Permissions' : 'Reset'}
                </>
              )}
            </Button>
          </div>
          )}

          {dialog?.mode === 'deviceSecret' && (
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={closeDialog}>Close</Button>
          </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {secretValue ? 'Regenerate Device Secret?' : 'Generate Device Secret?'}
            </DialogTitle>
            <DialogDescription>
              {secretValue
                ? `Replaces current secret for ${dialog?.initialData?.username}. Existing APKs stop working and must be rebuilt.`
                : `A new random secret will be created for ${dialog?.initialData?.username} and embedded into APKs they build.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegenDialogOpen(false)}
              disabled={secretSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRegenerateSecret}
              disabled={secretSaving}
              className="gap-2"
            >
              {secretSaving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Regenerating…</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> {secretValue ? 'Regenerate' : 'Generate'}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
