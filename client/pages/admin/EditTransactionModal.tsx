import React, { useState, useEffect, useRef } from 'react';
import { Loader, AlertCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Transaction, updateTransaction } from '@/services/transactions';
import { getAllDoctors, Doctor } from '@/services/doctors';
import { searchPatients, Patient } from '@/services/patients';
import { formatCurrency } from '@/lib/utils';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  onSaved: (updated: Transaction) => void;
}

const toLocalDatetime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function EditTransactionModal({ transaction: tx, onClose, onSaved }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Common fields
  const [dateTime, setDateTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [description, setDescription] = useState('');

  // Payment-in fields
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [hasLabFees, setHasLabFees] = useState(false);
  const [labFeesAmount, setLabFeesAmount] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!tx) return;
    setDateTime(toLocalDatetime(tx.created_at));
    setPaymentMethod(tx.payment_method || '');
    setDescription(tx.expense_description || '');
    setDoctorId(tx.doctor_id || '');
    setBaseAmount(tx.base_amount?.toString() || tx.final_amount?.toString() || '');
    setHasLabFees(tx.has_lab_fees || false);
    setLabFeesAmount(tx.lab_fees_amount?.toString() || '');
    if (tx.patient_name) {
      setPatientQuery(tx.patient_name);
      setSelectedPatient({ id: tx.patient_id!, full_name: tx.patient_name, patient_code: '', created_at: '', updated_at: '' });
    }
    getAllDoctors().then(setDoctors).catch(console.error);
  }, [tx]);

  useEffect(() => {
    const handleOut = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, []);

  useEffect(() => {
    if (patientQuery.length < 2) { setPatientResults([]); setShowDropdown(false); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try { const r = await searchPatients(patientQuery); setPatientResults(r); setShowDropdown(true); }
      catch { setPatientResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  }, [patientQuery]);

  if (!tx) return null;

  const baseNum = parseFloat(baseAmount) || 0;
  const finalAmount = paymentMethod === 'vodafone_cash' ? Math.round(baseNum * 1.01 * 100) / 100 : baseNum;

  const handleSave = async () => {
    if (!tx) return;
    setError('');
    setSaving(true);
    try {
      const updates: Parameters<typeof updateTransaction>[1] = {
        payment_method: (paymentMethod as any) || null,
        expense_description: description.trim() || null,
        created_at: dateTime ? new Date(dateTime).toISOString() : undefined,
      };

      if (tx.type === 'payment_in') {
        if (!selectedPatient) { setError('Patient is required.'); setSaving(false); return; }
        if (!doctorId) { setError('Doctor is required.'); setSaving(false); return; }
        if (!baseAmount || baseNum <= 0) { setError('Amount is required.'); setSaving(false); return; }
        updates.patient_id = selectedPatient.id;
        updates.patient_name = selectedPatient.full_name;
        updates.doctor_id = doctorId;
        updates.base_amount = baseNum;
        updates.final_amount = finalAmount;
        updates.has_lab_fees = hasLabFees;
        updates.lab_fees_amount = hasLabFees && labFeesAmount ? parseFloat(labFeesAmount) : null;
      } else {
        if (!description.trim()) { setError('Description is required.'); setSaving(false); return; }
        updates.final_amount = baseNum;
        updates.base_amount = baseNum;
      }

      const updated = await updateTransaction(tx.id, updates);
      onSaved(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Transaction —{' '}
            <span className={tx.type === 'payment_in' ? 'text-green-600' : 'text-red-500'}>
              {tx.type === 'payment_in' ? 'Payment In' : 'Expense Out'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Date / Time */}
          <div className="space-y-1.5">
            <Label>Date & Time</Label>
            <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </div>

          {tx.type === 'payment_in' && (
            <>
              {/* Patient */}
              <div className="space-y-1.5">
                <Label>Patient *</Label>
                {selectedPatient ? (
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedPatient.full_name}</p>
                      {selectedPatient.patient_code && <p className="text-xs text-muted-foreground">{selectedPatient.patient_code}</p>}
                    </div>
                    <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(''); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search patient..."
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                        onFocus={() => patientResults.length > 0 && setShowDropdown(true)}
                        className="pl-9"
                      />
                      {searchLoading && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {showDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button key={p.id} type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-muted/50 border-b last:border-0"
                            onClick={() => { setSelectedPatient(p); setPatientQuery(p.full_name); setShowDropdown(false); }}>
                            <p className="font-medium text-sm">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor */}
              <div className="space-y-1.5">
                <Label>Doctor *</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} ({d.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                <SelectItem value="instapay">Instapay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>{tx.type === 'payment_in' ? 'Base Amount (EGP) *' : 'Amount (EGP) *'}</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
            {tx.type === 'payment_in' && paymentMethod === 'vodafone_cash' && baseNum > 0 && (
              <p className="text-sm text-blue-600 font-medium">Total + 1% = {formatCurrency(finalAmount)}</p>
            )}
          </div>

          {/* Lab Fees (payment_in only) */}
          {tx.type === 'payment_in' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="edit-lab" checked={hasLabFees} onCheckedChange={(v) => { setHasLabFees(!!v); if (!v) setLabFeesAmount(''); }} />
                <Label htmlFor="edit-lab" className="cursor-pointer">Lab fees included?</Label>
              </div>
              {hasLabFees && (
                <Input type="number" min="0" step="0.01" placeholder="Lab fees amount (leave blank if unknown)" value={labFeesAmount} onChange={(e) => setLabFeesAmount(e.target.value)} />
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>{tx.type === 'expense_out' ? 'Description *' : 'Notes (optional)'}</Label>
            <Input placeholder={tx.type === 'expense_out' ? 'What was this expense for?' : 'Any notes...'} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
