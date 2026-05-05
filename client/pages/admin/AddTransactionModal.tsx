import { useState, useEffect, useRef } from 'react';
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
import { Transaction, createPaymentIn, createExpenseOut } from '@/services/transactions';
import { getActiveDoctors, Doctor } from '@/services/doctors';
import { searchPatients, createPatient, Patient } from '@/services/patients';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';

interface Props {
  open: boolean;
  defaultDate: string; // YYYY-MM-DD
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
}

const toLocalDatetime = (dateStr: string) => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export function AddTransactionModal({ open, defaultDate, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [type, setType] = useState<'payment_in' | 'expense_out'>('payment_in');
  const [dateTime, setDateTime] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Patient
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientCode, setNewPatientCode] = useState('');

  // Payment fields
  const [doctorId, setDoctorId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [hasLabFees, setHasLabFees] = useState(false);
  const [labFeesAmount, setLabFeesAmount] = useState('');
  const [description, setDescription] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setDateTime(toLocalDatetime(defaultDate));
      setType('payment_in');
      setError('');
      resetForm();
      getActiveDoctors().then(setDoctors).catch(console.error);
    }
  }, [open, defaultDate]);

  const resetForm = () => {
    setSelectedPatient(null); setPatientQuery(''); setPatientResults([]);
    setCreatingNew(false); setNewPatientName(''); setNewPatientCode('');
    setDoctorId(''); setPaymentMethod(''); setBaseAmount('');
    setHasLabFees(false); setLabFeesAmount(''); setDescription('');
  };

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

  if (!user) return null;

  const baseNum = parseFloat(baseAmount) || 0;
  const finalAmount = paymentMethod === 'vodafone_cash' ? Math.round(baseNum * 1.01 * 100) / 100 : baseNum;

  const handleSave = async () => {
    setError('');
    setSaving(true);

    const parsedDate = dateTime ? new Date(dateTime) : new Date();
    const createdAt = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    try {
      let saved: Transaction;

      if (type === 'payment_in') {
        let patientId = selectedPatient?.id || '';
        let patientName = selectedPatient?.full_name || '';
        if (creatingNew) {
          if (!newPatientName.trim() || !newPatientCode.trim()) { setError('Patient name and code are required.'); setSaving(false); return; }
          const p = await createPatient({ full_name: newPatientName.trim(), patient_code: newPatientCode.trim() });
          patientId = p.id; patientName = p.full_name;
        }
        if (!patientId) { setError('Select or create a patient.'); setSaving(false); return; }
        if (!doctorId) { setError('Select a doctor.'); setSaving(false); return; }
        if (!paymentMethod) { setError('Select a payment method.'); setSaving(false); return; }
        if (!baseAmount || baseNum <= 0) { setError('Enter a valid amount.'); setSaving(false); return; }

        saved = await createPaymentIn({
          assistant_id: user.id,
          assistant_name: user.full_name,
          patient_id: patientId,
          patient_name: patientName,
          doctor_id: doctorId,
          payment_method: paymentMethod as any,
          base_amount: baseNum,
          final_amount: finalAmount,
          has_lab_fees: hasLabFees,
          lab_fees_amount: hasLabFees && labFeesAmount ? parseFloat(labFeesAmount) : null,
          expense_description: description.trim() || null,
          created_at: createdAt,
        });
      } else {
        if (!description.trim()) { setError('Description is required.'); setSaving(false); return; }
        if (!paymentMethod) { setError('Select a payment method.'); setSaving(false); return; }
        if (!baseAmount || baseNum <= 0) { setError('Enter a valid amount.'); setSaving(false); return; }

        saved = await createExpenseOut({
          assistant_id: user.id,
          assistant_name: user.full_name,
          final_amount: baseNum,
          expense_description: description.trim(),
          payment_method: paymentMethod as any,
          created_at: createdAt,
        });
      }

      onSaved(saved);
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
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
            <Label>Date & Time *</Label>
            <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => { setType(v as any); resetForm(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="payment_in">Payment In</SelectItem>
                <SelectItem value="expense_out">Expense Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'payment_in' && (
            <>
              {/* Patient */}
              <div className="space-y-1.5">
                <Label>Patient *</Label>
                {selectedPatient ? (
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedPatient.full_name}</p>
                      <p className="text-xs text-muted-foreground">{selectedPatient.patient_code}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(''); setCreatingNew(false); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : creatingNew ? (
                  <div className="space-y-2 p-3 border rounded-lg bg-blue-50 border-blue-200">
                    <p className="text-sm font-medium text-blue-700">New Patient</p>
                    <Input placeholder="Full name *" value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} />
                    <Input placeholder="Patient code (e.g. P-0042) *" value={newPatientCode} onChange={(e) => setNewPatientCode(e.target.value)} />
                    <button type="button" onClick={() => setCreatingNew(false)} className="text-xs text-blue-600 underline">Cancel — search instead</button>
                  </div>
                ) : (
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Search by name or code..." value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                        onFocus={() => patientResults.length > 0 && setShowDropdown(true)}
                        className="pl-9" />
                      {searchLoading && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {showDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button key={p.id} type="button" className="w-full text-left px-4 py-2.5 hover:bg-muted/50 border-b last:border-0"
                            onClick={() => { setSelectedPatient(p); setPatientQuery(p.full_name); setShowDropdown(false); }}>
                            <p className="font-medium text-sm">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                          </button>
                        ))}
                        <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-blue-600 text-sm font-medium"
                          onClick={() => { setCreatingNew(true); setShowDropdown(false); }}>
                          + Create new patient
                        </button>
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
                    {doctors.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name} ({d.type})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label>Payment Method *</Label>
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
            <Label>{type === 'payment_in' ? 'Base Amount (EGP) *' : 'Amount (EGP) *'}</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
            {type === 'payment_in' && paymentMethod === 'vodafone_cash' && baseNum > 0 && (
              <p className="text-sm text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded px-3 py-1.5">Total + 1% = {formatCurrency(finalAmount)}</p>
            )}
          </div>

          {/* Lab Fees (payment_in only) */}
          {type === 'payment_in' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="add-lab" checked={hasLabFees} onCheckedChange={(v) => { setHasLabFees(!!v); if (!v) setLabFeesAmount(''); }} />
                <Label htmlFor="add-lab" className="cursor-pointer">Lab fees included?</Label>
              </div>
              {hasLabFees && (
                <Input type="number" min="0" step="0.01" placeholder="Lab fees amount (leave blank to fill later)" value={labFeesAmount} onChange={(e) => setLabFeesAmount(e.target.value)} />
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>{type === 'expense_out' ? 'Description *' : 'Notes (optional)'}</Label>
            <Input placeholder={type === 'expense_out' ? 'What was this expense for?' : 'Any notes...'} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Add Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
