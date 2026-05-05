import { useState, useEffect } from 'react';
import { AlertCircle, Loader, Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
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
import { getAllDoctors, createDoctor, updateDoctor, Doctor } from '@/services/doctors';
import { useLanguage } from '@/contexts/LanguageContext';

const EMPTY_FORM = {
  name: '',
  type: '' as 'primary' | 'extern' | 'custom' | '',
  custom_percentage: '',
  custom_label: '',
};

export default function AdminDoctors() {
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setDoctors(await getAllDoctors());
    } catch (err: any) {
      setError(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingDoctor(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setForm({
      name: doc.name,
      type: doc.type,
      custom_percentage: doc.custom_percentage?.toString() || '',
      custom_label: doc.custom_label || '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  const toggleActive = async (doc: Doctor) => {
    try {
      await updateDoctor(doc.id, { is_active: !doc.is_active });
      setDoctors((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_active: !d.is_active } : d))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update doctor');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Doctor name is required.');
      return;
    }
    if (!form.type) {
      setFormError('Doctor type is required.');
      return;
    }
    if (form.type === 'custom' && (!form.custom_percentage || Number(form.custom_percentage) <= 0)) {
      setFormError('Custom percentage is required and must be > 0.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload: Omit<Doctor, 'id' | 'created_at' | 'updated_at'> = {
        name: form.name.trim(),
        type: form.type as 'primary' | 'extern' | 'custom',
        custom_percentage: form.type === 'custom' ? Number(form.custom_percentage) : null,
        custom_label: form.type === 'custom' ? form.custom_label.trim() || null : null,
        is_active: editingDoctor ? editingDoctor.is_active : true,
      };

      if (editingDoctor) {
        const updated = await updateDoctor(editingDoctor.id, payload);
        setDoctors((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const created = await createDoctor(payload);
        setDoctors((prev) => [...prev, created]);
      }

      setDialogOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save doctor');
    } finally {
      setSaving(false);
    }
  };

  const doctorTypeLabel = (d: Doctor) => {
    if (d.type === 'primary') return t('Primary');
    if (d.type === 'extern') return 'Extern (40%)';
    return d.custom_label ? `Custom — ${d.custom_label}` : `Custom (${d.custom_percentage}%)`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('Doctor Management')}</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage clinic doctor profiles</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> {t('Add Doctor')}
        </Button>
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
            {t('All Doctors')}
            <Badge variant="secondary" className="ml-auto">{doctors.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No doctors added yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('Name')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t('Status')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{doc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{doctorTypeLabel(doc)}</td>
                      <td className="px-4 py-3">
                        {doc.is_active ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{t('Active')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('Inactive')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(doc)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(doc)}
                            title={doc.is_active ? 'Deactivate' : 'Reactivate'}
                          >
                            {doc.is_active ? (
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
            <DialogTitle>{editingDoctor ? t('Edit') + ' Doctor' : t('Add Doctor')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Doctor Name *</Label>
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as any, custom_percentage: '', custom_label: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">{t('Primary')} (clinic share)</SelectItem>
                  <SelectItem value="extern">{t('Extern')} (40% of net)</SelectItem>
                  <SelectItem value="custom">{t('Custom')} percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Custom Percentage (%) *</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="e.g. 35"
                    value={form.custom_percentage}
                    onChange={(e) => setForm((f) => ({ ...f, custom_percentage: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Label (optional)</Label>
                  <Input
                    placeholder="e.g. Visiting Specialist"
                    value={form.custom_label}
                    onChange={(e) => setForm((f) => ({ ...f, custom_label: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('Cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
