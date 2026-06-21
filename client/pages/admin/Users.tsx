import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, Plus, Pencil, ToggleLeft, ToggleRight, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllUsers, createUser, updateUser, User } from '@/services/users';
import { getAllDoctors, getDoctorTypeLabel, getDoctorDisplayName, Doctor } from '@/services/doctors';
import { useLanguage } from '@/contexts/LanguageContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  doctor: 'Doctor',
  assistant: 'Assistant',
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    password: '',
    role: '' as 'admin' | 'doctor' | 'assistant' | '',
    doctor_id: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);

    // Load users and doctors independently — a failure in one shouldn't block the other
    const [usersResult, doctorsResult] = await Promise.allSettled([
      getAllUsers(),
      getAllDoctors(),
    ]);

    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value);
    } else {
      setError((usersResult.reason as any)?.message || 'Failed to load users');
    }

    if (doctorsResult.status === 'fulfilled') {
      setDoctors(doctorsResult.value);
    }
    // Doctors failure is silent — the dropdown will just be empty with a hint

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingUser(null);
    setForm({ username: '', full_name: '', password: '', role: '', doctor_id: '' });
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      full_name: u.full_name,
      password: '',
      role: u.role,
      doctor_id: u.doctor_id || '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  const toggleActive = async (u: User) => {
    try {
      await updateUser(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return; }
    if (!form.role) { setFormError('Role is required.'); return; }
    if (!editingUser && !form.username.trim()) { setFormError('Username is required.'); return; }
    if (!editingUser && !form.password.trim()) { setFormError('Password is required.'); return; }
    if (form.role === 'doctor' && !form.doctor_id) { setFormError('Doctor profile is required for doctor role.'); return; }

    setSaving(true);
    setFormError('');

    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          full_name: form.full_name.trim(),
          role: form.role as any,
          doctor_id: form.role === 'doctor' ? form.doctor_id || null : null,
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      } else {
        const created = await createUser({
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          password: form.password,
          role: form.role as any,
          doctor_id: form.role === 'doctor' ? form.doctor_id || null : null,
        });
        setUsers((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const getDoctorName = (doctorId: string | null) => {
    if (!doctorId) return '—';
    const d = doctors.find((d) => d.id === doctorId);
    return d ? getDoctorDisplayName(d) : '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('User Management')}</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage clinic user accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/doctors')}>
            <Stethoscope className="w-4 h-4 mr-2" /> {t('Doctors')}
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" /> {t('Add User')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t('All Users')}
            <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: '650px', width: '100%' }}>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Username</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Name')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Role')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Doctor')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Status')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{u.username}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{u.full_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          className={
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-100'
                              : u.role === 'doctor'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                              : 'bg-orange-100 text-orange-800 hover:bg-orange-100'
                          }
                        >
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{getDoctorName(u.doctor_id)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.is_active ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{t('Active')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('Inactive')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(u)}
                            title={u.is_active ? 'Deactivate' : 'Reactivate'}
                          >
                            {u.is_active ? (
                              <ToggleRight className="w-5 h-5 text-green-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? t('Edit') + ' User' : 'Create New User'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            {!editingUser && (
              <div className="space-y-2">
                <Label>Username * <span className="text-xs text-muted-foreground">(login ID, cannot be changed)</span></Label>
                <Input
                  placeholder="e.g. dr.ahmed"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('Name')} *</Label>
              <Input
                placeholder="Full name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  placeholder="Set initial password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('Role')} *</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as any, doctor_id: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">{t('Doctor')}</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === 'doctor' && (
              <div className="space-y-2">
                <Label>Linked Doctor Profile *</Label>
                {doctors.length === 0 ? (
                  <p className="text-sm text-amber-600 border border-amber-200 bg-amber-50 rounded-md px-3 py-2">
                    No doctor profiles found. Go to <strong>Doctors</strong> and create one first.
                  </p>
                ) : (
                  <Select
                    value={form.doctor_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, doctor_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({getDoctorTypeLabel(d)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? t('Saving...') : editingUser ? t('Save Changes') : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
