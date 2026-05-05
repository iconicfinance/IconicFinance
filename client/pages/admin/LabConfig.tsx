import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, Loader, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { getAllLabs, createLab, updateLab, deleteLab, type Lab } from '@/services/labs';

export default function LabConfig() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lab | null>(null);
  const [formName, setFormName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Lab | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setLabs(await getAllLabs());
    } catch (e: any) {
      setError(e.message || 'Failed to load labs');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFormName('');
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (lab: Lab) => {
    setEditing(lab);
    setFormName(lab.name);
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) { setFormError('Lab name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        const updated = await updateLab(editing.id, { name });
        setLabs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      } else {
        const created = await createLab(name);
        setLabs((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (e: any) {
      setFormError(e.message || 'Failed to save lab');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (lab: Lab) => {
    try {
      const updated = await updateLab(lab.id, { is_active: !lab.is_active });
      setLabs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (e: any) {
      setError(e.message || 'Failed to update lab');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLab(deleteTarget.id);
      setLabs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete lab. It may be in use by existing transactions.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lab Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">Define the labs used in patient transactions</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Lab
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
            <FlaskConical className="w-4 h-4" />
            Labs
            <Badge variant="secondary" className="ml-auto">{labs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : labs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No labs added yet. Add one to start tracking lab fees by lab.
            </div>
          ) : (
            <div className="divide-y">
              {labs.map((lab) => (
                <div key={lab.id} className="flex items-center gap-3 px-4 py-3">
                  <FlaskConical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 font-medium text-sm">{lab.name}</span>
                  <Badge variant={lab.is_active ? 'default' : 'secondary'}>
                    {lab.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <button
                    onClick={() => toggleActive(lab)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {lab.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEdit(lab)} className="p-1.5 hover:bg-muted rounded">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setDeleteTarget(lab)} className="p-1.5 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Lab' : 'Add Lab'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-600">{formError}</div>
            )}
            <Input
              placeholder="Lab name (e.g. Central Lab, BioLab)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Lab'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Lab</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong>{deleteTarget?.name}</strong>? This will fail if the lab has existing fee records.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
