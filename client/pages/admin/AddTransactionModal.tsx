import { useState, useEffect, useRef } from 'react';
import { Loader, AlertCircle, Search, X, Plus, Trash2, AlertTriangle, Pencil } from 'lucide-react';
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
import { getActiveLabs, Lab } from '@/services/labs';
import { saveLabFeesForTransaction } from '@/services/transactionLabFees';
import { searchPatients, createPatient, Patient } from '@/services/patients';
import {
  getPatientBalance, upsertPatientBalance, updatePatientBalance,
  logBalanceEvent, type PatientBalance,
} from '@/services/patientBalance';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { normalizeNumbers } from '@/lib/i18n';
import { useLanguage } from '@/contexts/LanguageContext';

interface LabEntry { labId: string; amount: string; }

interface Props {
  open: boolean;
  defaultDate: string;
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
  const { t } = useLanguage();

  const [type, setType]         = useState<'payment_in' | 'expense_out'>('payment_in');
  const [dateTime, setDateTime] = useState('');
  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [labs, setLabs]         = useState<Lab[]>([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // ── Patient ──────────────────────────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery]       = useState('');
  const [patientResults, setPatientResults]   = useState<Patient[]>([]);
  const [showDropdown, setShowDropdown]       = useState(false);
  const [searchLoading, setSearchLoading]     = useState(false);
  const [creatingNew, setCreatingNew]         = useState(false);
  const [newPatientName, setNewPatientName]   = useState('');
  const [newPatientCode, setNewPatientCode]   = useState('');

  // ── Doctor ────────────────────────────────────────────────────────────────────
  const [doctorId, setDoctorId] = useState('');

  // ── Balance ───────────────────────────────────────────────────────────────────
  const [balance, setBalance]             = useState<PatientBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [editingTotal, setEditingTotal]   = useState(false);
  const [newTotalValue, setNewTotalValue] = useState('');

  // ── Payment amounts ───────────────────────────────────────────────────────────
  const [totalClinical, setTotalClinical] = useState(''); // full treatment cost
  const [payToday, setPayToday]           = useState(''); // amount paid today
  const [paymentMethod, setPaymentMethod] = useState('');

  // ── Lab fees ──────────────────────────────────────────────────────────────────
  const [hasLabFees, setHasLabFees]   = useState(false);
  const [labEntries, setLabEntries]   = useState<LabEntry[]>([{ labId: '', amount: '' }]);

  // ── Expense fields ────────────────────────────────────────────────────────────
  const [expenseAmount, setExpenseAmount] = useState('');
  const [description, setDescription]    = useState('');

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setDateTime(toLocalDatetime(defaultDate));
      setType('payment_in');
      setError('');
      resetForm();
      Promise.allSettled([getActiveDoctors(), getActiveLabs()]).then(([dr, lb]) => {
        if (dr.status === 'fulfilled') setDoctors(dr.value);
        if (lb.status === 'fulfilled') setLabs(lb.value);
      });
    }
  }, [open, defaultDate]);

  const resetForm = () => {
    setSelectedPatient(null); setPatientQuery(''); setPatientResults([]);
    setCreatingNew(false); setNewPatientName(''); setNewPatientCode('');
    setDoctorId(''); setPaymentMethod('');
    setTotalClinical(''); setPayToday('');
    setBalance(null); setEditingTotal(false); setNewTotalValue('');
    setHasLabFees(false); setLabEntries([{ labId: '', amount: '' }]);
    setDescription(''); setExpenseAmount('');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Debounced patient search
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

  // Load balance when patient + doctor selected
  useEffect(() => {
    if (!selectedPatient || !doctorId || type !== 'payment_in') { setBalance(null); return; }
    setBalanceLoading(true);
    getPatientBalance(selectedPatient.id, doctorId)
      .then((b) => {
        setBalance(b);
        if (b && !b.is_settled) setNewTotalValue(String(b.total_due));
      })
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [selectedPatient?.id, doctorId, type]);

  if (!user) return null;

  // ── Computed values ───────────────────────────────────────────────────────────
  const payTodayNum      = parseFloat(payToday) || 0;
  const totalClinicalNum = parseFloat(totalClinical) || 0;
  const expenseNum       = parseFloat(expenseAmount) || 0;
  const totalLabFees     = labEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const finalDueToday    = paymentMethod === 'vodafone_cash'
    ? Math.round(payTodayNum * 1.01 * 100) / 100
    : payTodayNum;
  const vodafoneFee      = finalDueToday - payTodayNum;
  const creditToBalance  = payTodayNum; // base amount credited, not the 1% fee

  const activeBalance    = balance && !balance.is_settled ? balance : null;
  const effectiveTotalDue = activeBalance
    ? (parseFloat(newTotalValue) || activeBalance.total_due)
    : totalClinicalNum;
  const remaining        = activeBalance ? activeBalance.total_due - activeBalance.total_paid : 0;
  const afterPayment     = Math.max(0, effectiveTotalDue - (activeBalance?.total_paid ?? 0) - creditToBalance);

  // ── Lab helpers ───────────────────────────────────────────────────────────────
  const addLabEntry    = () => setLabEntries((p) => [...p, { labId: '', amount: '' }]);
  const removeLabEntry = (i: number) => setLabEntries((p) => p.filter((_, idx) => idx !== i));
  const updateLabEntry = (i: number, field: keyof LabEntry, val: string) =>
    setLabEntries((p) => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError('');
    setSaving(true);

    const parsedDate = dateTime ? new Date(dateTime) : new Date();
    const createdAt  = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    try {
      let saved: Transaction | undefined;

      if (type === 'payment_in') {
        // Resolve patient
        let patientId   = selectedPatient?.id || '';
        let patientName = selectedPatient?.full_name || '';
        if (creatingNew) {
          if (!newPatientName.trim() || !newPatientCode.trim()) {
            setError(t('Patient name and code are required.')); setSaving(false); return;
          }
          const p = await createPatient({
            full_name: newPatientName.trim(),
            patient_code: normalizeNumbers(newPatientCode.trim()),
          });
          patientId = p.id; patientName = p.full_name;
        }
        if (!patientId) { setError(t('Please select or create a patient.')); setSaving(false); return; }
        if (!doctorId)  { setError(t('Please select a doctor.'));             setSaving(false); return; }

        const isRecordingPayment = payTodayNum > 0;

        if (isRecordingPayment && !paymentMethod) {
          setError(t('Please select a payment method.')); setSaving(false); return;
        }

        const validLabs = hasLabFees
          ? labEntries.filter((e) => e.labId && parseFloat(e.amount) > 0)
          : [];

        // Always create a transaction (even 0-amount visits), so lab fees and
        // total-only updates have a row to attach to and show up in the tables.
        saved = await createPaymentIn({
          assistant_id:   user.id,
          assistant_name: user.full_name,
          patient_id:     patientId,
          patient_name:   patientName,
          doctor_id:      doctorId,
          payment_method: (paymentMethod || null) as any,
          base_amount:    payTodayNum,
          final_amount:   finalDueToday,
          has_lab_fees:   validLabs.length > 0,
          lab_fees_amount: validLabs.length > 0 ? totalLabFees : null,
          expense_description: description.trim() || null,
          created_at: createdAt,
        });
        const txId = saved.id;

        if (validLabs.length > 0) {
          await saveLabFeesForTransaction(
            txId,
            validLabs.map((e) => ({ lab_id: e.labId, amount: parseFloat(e.amount) }))
          );
        }

        // ── Balance tracking ────────────────────────────────────────────────────
        if (activeBalance) {
          const newTotalDue  = parseFloat(newTotalValue) || activeBalance.total_due;
          const newTotalPaid = activeBalance.total_paid + creditToBalance;
          const newRemaining = Math.max(0, newTotalDue - newTotalPaid);

          if (newTotalDue !== activeBalance.total_due) {
            logBalanceEvent({
              patient_id: patientId, doctor_id: doctorId,
              event_type: 'total_updated',
              old_total: activeBalance.total_due, new_total: newTotalDue,
              payment_amount: null, new_remaining: newTotalDue - activeBalance.total_paid,
              transaction_id: txId, notes: null,
            });
          }
          if (isRecordingPayment) {
            logBalanceEvent({
              patient_id: patientId, doctor_id: doctorId,
              event_type: 'payment',
              old_total: null, new_total: newTotalDue,
              payment_amount: creditToBalance, new_remaining: newRemaining,
              transaction_id: txId, notes: null,
            });
          }
          await updatePatientBalance(activeBalance.id, {
            total_due:  newTotalDue,
            total_paid: Math.min(newTotalPaid, newTotalDue),
            is_settled: newTotalPaid >= newTotalDue,
          });
        } else if (totalClinicalNum > 0) {
          const newRemaining = Math.max(0, totalClinicalNum - creditToBalance);
          logBalanceEvent({
            patient_id: patientId, doctor_id: doctorId,
            event_type: 'balance_created',
            old_total: null, new_total: totalClinicalNum,
            payment_amount: creditToBalance, new_remaining: newRemaining,
            transaction_id: txId, notes: null,
          });
          await upsertPatientBalance({
            patient_id: patientId, doctor_id: doctorId,
            total_due:  totalClinicalNum,
            total_paid: Math.min(creditToBalance, totalClinicalNum),
            is_settled: creditToBalance >= totalClinicalNum,
          });
        }

      } else {
        // Expense out
        if (!description.trim()) { setError(t('Description is required.')); setSaving(false); return; }
        if (!paymentMethod)      { setError(t('Please select a payment method.')); setSaving(false); return; }
        if (expenseNum <= 0)     { setError(t('Please enter a valid amount.')); setSaving(false); return; }

        saved = await createExpenseOut({
          assistant_id:   user.id,
          assistant_name: user.full_name,
          final_amount:   expenseNum,
          expense_description: description.trim(),
          payment_method: paymentMethod as any,
          created_at: createdAt,
        });
      }

      if (saved) onSaved(saved);
      else onClose();
    } catch (err: any) {
      setError(err.message || t('Failed to load'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Add Transaction')}</DialogTitle>
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
            <Label>{t('Date & Time')} *</Label>
            <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} dir="ltr" />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>{t('Type')} *</Label>
            <Select value={type} onValueChange={(v) => { setType(v as any); resetForm(); setDateTime(toLocalDatetime(defaultDate)); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="payment_in">{t('Payment In')}</SelectItem>
                <SelectItem value="expense_out">{t('Expense Out')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── PAYMENT IN ─────────────────────────────────────────────────────── */}
          {type === 'payment_in' && (
            <>
              {/* Patient */}
              <div className="space-y-1.5">
                <Label>{t('Patient')} *</Label>
                {selectedPatient ? (
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedPatient.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedPatient.patient_code}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(''); setCreatingNew(false); setBalance(null); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : creatingNew ? (
                  <div className="space-y-2 p-3 border rounded-lg bg-blue-50 border-blue-200">
                    <p className="text-sm font-medium text-blue-700">{t('New Patient')}</p>
                    <Input placeholder={t('Full name *')} value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} />
                    <Input placeholder={t('Patient Code (e.g. P-0042) *')} value={newPatientCode} onChange={(e) => setNewPatientCode(e.target.value)} dir="ltr" className="ltr-field" />
                    <button type="button" onClick={() => setCreatingNew(false)} className="text-xs text-blue-600 underline">
                      {t('Cancel — search instead')}
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={t('Search...')}
                        value={patientQuery}
                        onChange={(e) => setPatientQuery(e.target.value)}
                        onFocus={() => patientResults.length > 0 && setShowDropdown(true)}
                        className="ps-9"
                      />
                      {searchLoading && <Loader className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {showDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button key={p.id} type="button" className="w-full text-left px-4 py-2.5 hover:bg-muted/50 border-b last:border-0"
                            onClick={() => { setSelectedPatient(p); setPatientQuery(p.full_name); setShowDropdown(false); }}>
                            <p className="font-medium text-sm">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.patient_code}</p>
                          </button>
                        ))}
                        <button type="button" className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-blue-600 text-sm font-medium"
                          onClick={() => {
                            const q = patientQuery.trim();
                            if (q) { /^\d+$/.test(q) ? setNewPatientCode(q) : setNewPatientName(q); }
                            setCreatingNew(true); setShowDropdown(false);
                          }}>
                          + {t('Create new patient')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor */}
              <div className="space-y-1.5">
                <Label>{t('Doctor')} *</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger><SelectValue placeholder={t('Select a doctor')} /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.type === 'custom' ? d.custom_label || t('Custom') : d.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Total Clinical / Outstanding balance */}
              {balanceLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader className="w-4 h-4 animate-spin" /> {t('Checking balance...')}
                </div>
              )}

              {!balanceLoading && activeBalance && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">{t('Outstanding Balance')}</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {t('Remaining')}: <strong>{formatCurrency(remaining)}</strong>
                        {' '}({t('Paid so far')} {formatCurrency(activeBalance.total_paid)} {t('of')} {formatCurrency(activeBalance.total_due)})
                      </p>
                    </div>
                  </div>
                  {editingTotal ? (
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" step="0.01" placeholder={t('Total Clinical')}
                        value={newTotalValue} onChange={(e) => setNewTotalValue(e.target.value)}
                        className="flex-1 h-8 text-sm" />
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingTotal(false)}>
                        {t('Done')}
                      </Button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditingTotal(true)}
                      className="flex items-center gap-1 text-xs text-amber-700 underline">
                      <Pencil className="w-3 h-3" />
                      {t('Change total')} ({formatCurrency(parseFloat(newTotalValue) || activeBalance.total_due)})
                    </button>
                  )}
                </div>
              )}

              {!balanceLoading && !activeBalance && (selectedPatient || creatingNew) && (
                <div className="space-y-1.5">
                  <Label>{t('Total Clinical (EGP)')}</Label>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 3000"
                    value={totalClinical} onChange={(e) => setTotalClinical(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    {t('Enter the full treatment cost. If patient pays less today, the difference is tracked as a remaining balance.')}
                  </p>
                </div>
              )}

              {/* Lab Fees */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="add-lab" checked={hasLabFees}
                    onCheckedChange={(v) => { setHasLabFees(!!v); if (!v) setLabEntries([{ labId: '', amount: '' }]); }} />
                  <Label htmlFor="add-lab" className="cursor-pointer">{t('Lab fees included?')}</Label>
                </div>
                {hasLabFees && (
                  <div className="ps-6 space-y-2">
                    {labEntries.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Select value={entry.labId} onValueChange={(v) => updateLabEntry(i, 'labId', v)}>
                          <SelectTrigger className="flex-1 h-9"><SelectValue placeholder={t('Select lab')} /></SelectTrigger>
                          <SelectContent>
                            {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input type="number" min="0" step="0.01" placeholder={t('Amount')}
                          value={entry.amount} onChange={(e) => updateLabEntry(i, 'amount', e.target.value)}
                          className="w-24 h-9" />
                        {labEntries.length > 1 && (
                          <button type="button" onClick={() => removeLabEntry(i)}>
                            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addLabEntry} className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <Plus className="w-3.5 h-3.5" /> {t('Add another lab')}
                    </button>
                    {totalLabFees > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('Total lab fees:')} <strong>{formatCurrency(totalLabFees)}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>{t('Notes (optional)')}</Label>
                <Input placeholder={t('Any notes...')} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              {/* Pay Today */}
              <div className="space-y-1.5">
                <Label>
                  {t('Pay Today (EGP)')}
                  <span className="text-muted-foreground text-xs ms-1">({t('Leave 0 if not paying today')})</span>
                </Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00"
                  value={payToday} onChange={(e) => setPayToday(e.target.value)} />
              </div>

              {payTodayNum === 0 && (totalClinicalNum > 0 || activeBalance) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  {activeBalance
                    ? t('No payment today — balance total will be updated if changed.')
                    : `${t('No payment today — balance of')} ${formatCurrency(totalClinicalNum)} ${t('will be recorded as outstanding.')}`}
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label>{t('Payment Method')}{payTodayNum > 0 && ' *'}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder={t('Select payment method')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('Cash')}</SelectItem>
                    <SelectItem value="vodafone_cash">{t('Vodafone Cash')}</SelectItem>
                    <SelectItem value="instapay">{t('Instapay')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Total Due Today summary */}
              {payTodayNum > 0 && paymentMethod && (
                <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1">
                  {paymentMethod === 'vodafone_cash' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('Pay Today')}</span>
                        <span>{formatCurrency(payTodayNum)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('Vodafone fee (1%)')}</span>
                        <span className="text-blue-600">+{formatCurrency(vodafoneFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                        <span>{t('Total Due Today')}</span>
                        <span className="text-primary">{formatCurrency(finalDueToday)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('1% fee is charged to patient, not deducted from their balance.')}</p>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm font-semibold">
                      <span>{t('Total Due Today')}</span>
                      <span className="text-primary">{formatCurrency(finalDueToday)}</span>
                    </div>
                  )}
                  {(activeBalance || totalClinicalNum > 0) && (
                    <div className="flex justify-between text-sm border-t pt-1 mt-1">
                      <span className="text-muted-foreground">{t('Remaining after payment')}</span>
                      <span className={afterPayment > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
                        {afterPayment > 0 ? formatCurrency(afterPayment) : t('Fully paid ✓')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── EXPENSE OUT ───────────────────────────────────────────────────── */}
          {type === 'expense_out' && (
            <>
              <div className="space-y-1.5">
                <Label>{t('Payment Method')} *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue placeholder={t('Select payment method')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('Cash')}</SelectItem>
                    <SelectItem value="vodafone_cash">{t('Vodafone Cash')}</SelectItem>
                    <SelectItem value="instapay">{t('Instapay')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('Amount (EGP) *')}</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00"
                  value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('Description *')}</Label>
                <Input placeholder={t('What was this expense for?')}
                  value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader className="w-4 h-4 me-2 animate-spin" />}
            {saving ? t('Saving...') : t('Add Transaction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
