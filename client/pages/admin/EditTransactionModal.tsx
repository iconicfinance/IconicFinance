import { useState, useEffect, useRef } from 'react';
import { Loader, AlertCircle, Search, X, AlertTriangle, Pencil } from 'lucide-react';
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
import { getAllDoctors, getDoctorTypeLabel, Doctor } from '@/services/doctors';
import { searchPatients, Patient } from '@/services/patients';
import {
  getPatientBalance, upsertPatientBalance, updatePatientBalance,
  logBalanceEvent, type PatientBalance,
} from '@/services/patientBalance';
import { formatCurrency } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [dateTime, setDateTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [description, setDescription] = useState('');

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [hasLabFees, setHasLabFees] = useState(false);
  const [labFeesAmount, setLabFeesAmount] = useState('');

  const [balance, setBalance] = useState<PatientBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [editingTotal, setEditingTotal] = useState(false);
  const [newTotalValue, setNewTotalValue] = useState('');
  const [totalClinical, setTotalClinical] = useState('');

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
    setEditingTotal(false); setTotalClinical('');
    if (tx.patient_name) {
      setPatientQuery(tx.patient_name);
      setSelectedPatient({ id: tx.patient_id!, full_name: tx.patient_name, patient_code: '', created_at: '', updated_at: '' });
    }
    getAllDoctors().then(setDoctors).catch(console.error);
  }, [tx]);

  // Load the patient/doctor's outstanding balance so Total/Remaining can be reviewed or corrected
  useEffect(() => {
    if (!tx || tx.type !== 'payment_in' || !selectedPatient || !doctorId) { setBalance(null); return; }
    setBalanceLoading(true);
    getPatientBalance(selectedPatient.id, doctorId)
      .then((b) => {
        setBalance(b);
        setNewTotalValue(b && !b.is_settled ? String(b.total_due) : '');
      })
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [tx, selectedPatient?.id, doctorId]);

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
  const activeBalance = balance && !balance.is_settled ? balance : null;
  const remaining = activeBalance ? activeBalance.total_due - activeBalance.total_paid : 0;

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
        if (!selectedPatient) { setError(t('Patient') + ' ' + t('is required.')); setSaving(false); return; }
        if (!doctorId) { setError(t('Doctor') + ' ' + t('is required.')); setSaving(false); return; }
        if (!baseAmount || baseNum <= 0) { setError(t('Please enter a valid amount.')); setSaving(false); return; }
        updates.patient_id = selectedPatient.id;
        updates.patient_name = selectedPatient.full_name;
        updates.doctor_id = doctorId;
        updates.base_amount = baseNum;
        updates.final_amount = finalAmount;
        updates.has_lab_fees = hasLabFees;
        updates.lab_fees_amount = hasLabFees && labFeesAmount ? parseFloat(labFeesAmount) : null;
      } else {
        if (!description.trim()) { setError(t('Description is required.')); setSaving(false); return; }
        updates.final_amount = baseNum;
        updates.base_amount = baseNum;
      }

      const updated = await updateTransaction(tx.id, updates);

      if (tx.type === 'payment_in' && selectedPatient && doctorId) {
        if (balance) {
          const parsedTotal = parseFloat(newTotalValue);
          if (!isNaN(parsedTotal) && parsedTotal !== balance.total_due) {
            logBalanceEvent({
              patient_id: selectedPatient.id, doctor_id: doctorId,
              event_type: 'total_updated',
              old_total: balance.total_due, new_total: parsedTotal,
              payment_amount: null, new_remaining: parsedTotal - balance.total_paid,
              transaction_id: tx.id, notes: null,
            });
            await updatePatientBalance(balance.id, {
              total_due: parsedTotal,
              is_settled: balance.total_paid >= parsedTotal,
            });
          }
        } else {
          const newTotal = parseFloat(totalClinical);
          if (newTotal > 0) {
            logBalanceEvent({
              patient_id: selectedPatient.id, doctor_id: doctorId,
              event_type: 'balance_created',
              old_total: null, new_total: newTotal,
              payment_amount: 0, new_remaining: newTotal,
              transaction_id: tx.id, notes: null,
            });
            await upsertPatientBalance({
              patient_id: selectedPatient.id, doctor_id: doctorId,
              total_due: newTotal, total_paid: 0, is_settled: false,
            });
          }
        }
      }

      onSaved(updated);
    } catch (err: any) {
      setError(err.message || t('Failed to load'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('Edit Transaction')} —{' '}
            <span className={tx.type === 'payment_in' ? 'text-green-600' : 'text-red-500'}>
              {tx.type === 'payment_in' ? t('Payment In') : t('Expense Out')}
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
            <Label>{t('Date & Time')}</Label>
            <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} dir="ltr" />
          </div>

          {tx.type === 'payment_in' && (
            <>
              {/* Patient */}
              <div className="space-y-1.5">
                <Label>{t('Patient')} *</Label>
                {selectedPatient ? (
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedPatient.full_name}</p>
                      {selectedPatient.patient_code && (
                        <p className="text-xs text-muted-foreground font-mono">{selectedPatient.patient_code}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(''); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
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
                          <button key={p.id} type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-muted/50 border-b last:border-0"
                            onClick={() => { setSelectedPatient(p); setPatientQuery(p.full_name); setShowDropdown(false); }}>
                            <p className="font-medium text-sm">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.patient_code}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor */}
              <div className="space-y-1.5">
                <Label>{t('Doctor')} *</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger><SelectValue placeholder={t('Select doctor')} /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} ({getDoctorTypeLabel(d)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Total / Remaining balance */}
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

              {!balanceLoading && !activeBalance && selectedPatient && (
                <div className="space-y-1.5">
                  <Label>{t('Total Clinical (EGP)')}</Label>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 3000"
                    value={totalClinical} onChange={(e) => setTotalClinical(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    {t('Enter the full treatment cost. If patient pays less today, the difference is tracked as a remaining balance.')}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label>{t('Payment Method')}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue placeholder={t('Select method')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('Cash')}</SelectItem>
                <SelectItem value="vodafone_cash">{t('Vodafone Cash')}</SelectItem>
                <SelectItem value="instapay">{t('Instapay')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>{tx.type === 'payment_in' ? t('Base Amount (EGP) *') : t('Amount (EGP) *')}</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
            {tx.type === 'payment_in' && paymentMethod === 'vodafone_cash' && baseNum > 0 && (
              <p className="text-sm text-blue-600 font-medium">
                {t('Total Due Today')}: {formatCurrency(finalAmount)}
              </p>
            )}
          </div>

          {/* Lab Fees */}
          {tx.type === 'payment_in' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="edit-lab" checked={hasLabFees} onCheckedChange={(v) => { setHasLabFees(!!v); if (!v) setLabFeesAmount(''); }} />
                <Label htmlFor="edit-lab" className="cursor-pointer">{t('Lab fees included?')}</Label>
              </div>
              {hasLabFees && (
                <Input type="number" min="0" step="0.01" placeholder={t('Lab fees amount')} value={labFeesAmount} onChange={(e) => setLabFeesAmount(e.target.value)} />
              )}
            </div>
          )}

          {/* Description / Notes */}
          <div className="space-y-1.5">
            <Label>{tx.type === 'expense_out' ? t('Description *') : t('Notes (optional)')}</Label>
            <Input
              placeholder={tx.type === 'expense_out' ? t('What was this expense for?') : t('Any notes...')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader className="w-4 h-4 me-2 animate-spin" />}
            {saving ? t('Saving...') : t('Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
