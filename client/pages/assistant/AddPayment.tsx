import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Loader, CheckCircle, Search, X,
  Plus, Trash2, AlertTriangle, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { searchPatients, createPatient, type Patient } from '@/services/patients';
import { getActiveDoctors, type Doctor } from '@/services/doctors';
import { getActiveLabs, type Lab } from '@/services/labs';
import { createPaymentIn } from '@/services/transactions';
import { saveLabFeesForTransaction } from '@/services/transactionLabFees';
import {
  getPatientBalance, upsertPatientBalance, updatePatientBalance, logBalanceEvent,
  type PatientBalance,
} from '@/services/patientBalance';
import { formatCurrency } from '@/lib/utils';

interface LabEntry { labId: string; amount: string; }

export default function AssistantAddPayment() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const successRoute =
    user?.role === 'admin' ? '/admin/dashboard'
    : user?.role === 'doctor' ? '/doctor/dashboard'
    : '/assistant/today';

  // ── Data ───────────────────────────────────────────────────────────────────
  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [labs, setLabs]         = useState<Lab[]>([]);

  // ── Patient selection ──────────────────────────────────────────────────────
  const [patientQuery, setPatientQuery]       = useState('');
  const [patientResults, setPatientResults]   = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown]       = useState(false);
  const [creatingNew, setCreatingNew]         = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newCode, setNewCode]                 = useState('');

  // ── Doctor ─────────────────────────────────────────────────────────────────
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // ── Balance ────────────────────────────────────────────────────────────────
  const [balance, setBalance]         = useState<PatientBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [editingTotal, setEditingTotal] = useState(false);
  const [newTotalValue, setNewTotalValue] = useState('');

  // ── Payment amounts ────────────────────────────────────────────────────────
  const [totalClinical, setTotalClinical] = useState(''); // full treatment cost
  const [payToday, setPayToday]           = useState(''); // amount paid now
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vodafone_cash' | 'instapay' | ''>('');

  // ── Lab fees ───────────────────────────────────────────────────────────────
  const [hasLabFees, setHasLabFees]   = useState(false);
  const [labEntries, setLabEntries]   = useState<LabEntry[]>([{ labId: '', amount: '' }]);

  // ── Misc ───────────────────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load doctors + labs once
  useEffect(() => {
    Promise.allSettled([getActiveDoctors(), getActiveLabs()]).then(([dr, lb]) => {
      if (dr.status === 'fulfilled') setDoctors(dr.value);
      if (lb.status === 'fulfilled') setLabs(lb.value);
    });
  }, []);

  // Debounced patient search
  useEffect(() => {
    if (patientQuery.length < 2) { setPatientResults([]); setShowDropdown(false); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try { setPatientResults(await searchPatients(patientQuery)); setShowDropdown(true); }
      catch { setPatientResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  }, [patientQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Load balance when patient + doctor selected
  useEffect(() => {
    if (!selectedPatient || !selectedDoctorId) { setBalance(null); return; }
    setBalanceLoading(true);
    getPatientBalance(selectedPatient.id, selectedDoctorId)
      .then((b) => {
        setBalance(b);
        if (b && !b.is_settled) setNewTotalValue(String(b.total_due));
      })
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [selectedPatient?.id, selectedDoctorId]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setPatientQuery(p.full_name);
    setShowDropdown(false);
    setCreatingNew(false);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientQuery('');
    setCreatingNew(false);
    setNewName('');
    setNewCode('');
    setBalance(null);
  };

  const startNewPatient = () => {
    setCreatingNew(true);
    setShowDropdown(false);
    setSelectedPatient(null);
    // Pre-fill from search query
    const q = patientQuery.trim();
    if (q) {
      if (/^\d+$/.test(q)) { setNewCode(q); setNewName(''); }
      else { setNewName(q); setNewCode(''); }
    }
  };

  const addLabEntry    = () => setLabEntries((p) => [...p, { labId: '', amount: '' }]);
  const removeLabEntry = (i: number) => setLabEntries((p) => p.filter((_, idx) => idx !== i));
  const updateLabEntry = (i: number, field: keyof LabEntry, val: string) =>
    setLabEntries((p) => p.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  // ── Computed values ────────────────────────────────────────────────────────

  const payTodayNum        = parseFloat(payToday) || 0;
  const totalClinicalNum   = parseFloat(totalClinical) || 0;
  const totalLabFees       = labEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const finalDueToday      = paymentMethod === 'vodafone_cash'
    ? Math.round(payTodayNum * 1.01 * 100) / 100
    : payTodayNum;
  const vodafoneFee        = finalDueToday - payTodayNum;

  // base_amount (net to clinic, excludes Vodafone fee) credited toward balance
  const creditToBalance    = payTodayNum;

  const activeBalance      = balance && !balance.is_settled ? balance : null;
  const effectiveTotalDue  = activeBalance
    ? (parseFloat(newTotalValue) || activeBalance.total_due)
    : totalClinicalNum;
  const currentPaid        = activeBalance?.total_paid ?? 0;
  const remaining          = activeBalance ? activeBalance.total_due - currentPaid : 0;
  const afterPayment       = Math.max(0, effectiveTotalDue - currentPaid - creditToBalance);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      let patientId   = selectedPatient?.id || '';
      let patientName = selectedPatient?.full_name || '';

      if (creatingNew) {
        if (!newName.trim() || !newCode.trim()) {
          setError('Patient name and code are required.'); setLoading(false); return;
        }
        const p = await createPatient({ full_name: newName.trim(), patient_code: newCode.trim() });
        patientId = p.id; patientName = p.full_name;
      }

      if (!patientId)        { setError('Please select or create a patient.');  setLoading(false); return; }
      if (!selectedDoctorId) { setError('Please select a doctor.');              setLoading(false); return; }
      if (!paymentMethod)    { setError('Please select a payment method.');      setLoading(false); return; }
      if (payTodayNum <= 0)  { setError('Please enter a valid amount to pay.');  setLoading(false); return; }

      const validLabs = hasLabFees
        ? labEntries.filter((e) => e.labId && parseFloat(e.amount) > 0)
        : [];

      const tx = await createPaymentIn({
        assistant_id: user.id,
        assistant_name: user.full_name,
        patient_id: patientId,
        patient_name: patientName,
        doctor_id: selectedDoctorId,
        payment_method: paymentMethod,
        base_amount: payTodayNum,
        final_amount: finalDueToday,
        has_lab_fees: validLabs.length > 0,
        lab_fees_amount: validLabs.length > 0 ? totalLabFees : null,
        expense_description: description.trim() || null,
      });

      if (validLabs.length > 0) {
        await saveLabFeesForTransaction(
          tx.id,
          validLabs.map((e) => ({ lab_id: e.labId, amount: parseFloat(e.amount) }))
        );
      }

      // ── Balance tracking ──────────────────────────────────────────────────
      if (activeBalance) {
        const newTotalDue  = parseFloat(newTotalValue) || activeBalance.total_due;
        const newTotalPaid = activeBalance.total_paid + creditToBalance;
        const newRemaining = Math.max(0, newTotalDue - newTotalPaid);

        // Log total change if it changed
        if (newTotalDue !== activeBalance.total_due) {
          logBalanceEvent({
            patient_id: patientId, doctor_id: selectedDoctorId,
            event_type: 'total_updated',
            old_total: activeBalance.total_due, new_total: newTotalDue,
            payment_amount: null,
            new_remaining: newTotalDue - activeBalance.total_paid,
            transaction_id: null, notes: null,
          });
        }
        // Log payment
        logBalanceEvent({
          patient_id: patientId, doctor_id: selectedDoctorId,
          event_type: 'payment',
          old_total: null, new_total: newTotalDue,
          payment_amount: creditToBalance, new_remaining: newRemaining,
          transaction_id: tx.id, notes: null,
        });

        await updatePatientBalance(activeBalance.id, {
          total_due:  newTotalDue,
          total_paid: Math.min(newTotalPaid, newTotalDue),
          is_settled: newTotalPaid >= newTotalDue,
        });
      } else if (totalClinicalNum > 0) {
        const newRemaining = Math.max(0, totalClinicalNum - creditToBalance);
        // Log balance creation + initial payment
        logBalanceEvent({
          patient_id: patientId, doctor_id: selectedDoctorId,
          event_type: 'balance_created',
          old_total: null, new_total: totalClinicalNum,
          payment_amount: creditToBalance, new_remaining: newRemaining,
          transaction_id: tx.id, notes: null,
        });

        await upsertPatientBalance({
          patient_id: patientId, doctor_id: selectedDoctorId,
          total_due:  totalClinicalNum,
          total_paid: Math.min(creditToBalance, totalClinicalNum),
          is_settled: creditToBalance >= totalClinicalNum,
        });
      }

      setSuccess(true);
      setTimeout(() => navigate(successRoute), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-semibold">Payment Recorded!</h2>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Payment</h1>
        <p className="text-muted-foreground text-sm mt-1">Record a new patient payment</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* ── Patient ── */}
            <div className="space-y-2">
              <Label>Patient *</Label>
              {selectedPatient ? (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedPatient.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatient.patient_code}</p>
                  </div>
                  <button type="button" onClick={clearPatient}>
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ) : creatingNew ? (
                <div className="space-y-3 p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <p className="text-sm font-medium text-blue-700">New Patient</p>
                  <Input placeholder="Full name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <Input placeholder="Patient code (e.g. P-0042) *" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                  <button type="button" onClick={clearPatient} className="text-xs text-blue-600 underline">
                    Cancel — search instead
                  </button>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or code..."
                      value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)}
                      onFocus={() => patientResults.length > 0 && setShowDropdown(true)}
                      className="pl-9"
                    />
                    {searchLoading && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                  {showDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {patientResults.map((p) => (
                        <button key={p.id} type="button" className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-0" onClick={() => selectPatient(p)}>
                          <p className="font-medium text-sm">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                        </button>
                      ))}
                      <button type="button" className="w-full text-left px-4 py-3 hover:bg-blue-50 text-blue-600 text-sm font-medium" onClick={startNewPatient}>
                        + Create new patient
                      </button>
                    </div>
                  )}
                  {patientQuery.length >= 2 && !searchLoading && !showDropdown && patientResults.length === 0 && (
                    <button type="button" className="text-sm text-blue-600 underline mt-2" onClick={startNewPatient}>
                      No results — create new patient
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Doctor ── */}
            <div className="space-y-2">
              <Label>Doctor *</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger><SelectValue placeholder="Select a doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.type === 'custom' ? d.custom_label || 'Custom' : d.type.charAt(0).toUpperCase() + d.type.slice(1)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Outstanding balance alert ── */}
            {balanceLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader className="w-4 h-4 animate-spin" /> Checking balance...</div>}

            {!balanceLoading && activeBalance && (
              <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Outstanding Balance</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Remaining: <strong>{formatCurrency(remaining)}</strong>
                      {' '}(Paid {formatCurrency(activeBalance.total_paid)} of {formatCurrency(activeBalance.total_due)})
                    </p>
                  </div>
                </div>

                {editingTotal ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="0" step="0.01" placeholder="New total"
                      value={newTotalValue}
                      onChange={(e) => setNewTotalValue(e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingTotal(false)}>Done</Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingTotal(true)} className="flex items-center gap-1 text-xs text-amber-700 underline">
                    <Pencil className="w-3 h-3" /> Change total ({formatCurrency(parseFloat(newTotalValue) || activeBalance.total_due)})
                  </button>
                )}
              </div>
            )}

            {/* ── Total Clinical (only when no active balance) ── */}
            {!balanceLoading && !activeBalance && (selectedPatient || creatingNew) && (
              <div className="space-y-1.5">
                <Label>Total Clinical (EGP)</Label>
                <Input
                  type="number" min="0" step="0.01" placeholder="e.g. 3000"
                  value={totalClinical}
                  onChange={(e) => setTotalClinical(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full treatment cost. If patient pays less today, the difference is tracked as a remaining balance.
                </p>
              </div>
            )}

            {/* ── Pay Today ── */}
            <div className="space-y-1.5">
              <Label>Pay Today (EGP) *</Label>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={payToday}
                onChange={(e) => setPayToday(e.target.value)}
              />
            </div>

            {/* ── Payment Method ── */}
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                  <SelectItem value="instapay">Instapay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Total Due Today (computed summary) ── */}
            {payTodayNum > 0 && paymentMethod && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1">
                {paymentMethod === 'vodafone_cash' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pay Today</span>
                      <span>{formatCurrency(payTodayNum)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vodafone fee (1%)</span>
                      <span className="text-blue-600">+{formatCurrency(vodafoneFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-1 mt-1">
                      <span>Total Due Today</span>
                      <span className="text-primary">{formatCurrency(finalDueToday)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">1% fee is charged to patient, not deducted from their balance.</p>
                  </>
                ) : (
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total Due Today</span>
                    <span className="text-primary">{formatCurrency(finalDueToday)}</span>
                  </div>
                )}

                {/* Remaining after payment */}
                {(activeBalance || totalClinicalNum > 0) && (
                  <div className="flex justify-between text-sm border-t pt-1 mt-1">
                    <span className="text-muted-foreground">Remaining after payment</span>
                    <span className={afterPayment > 0 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
                      {afterPayment > 0 ? formatCurrency(afterPayment) : 'Fully paid ✓'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Lab Fees ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lab-fees"
                  checked={hasLabFees}
                  onCheckedChange={(v) => { setHasLabFees(!!v); if (!v) setLabEntries([{ labId: '', amount: '' }]); }}
                />
                <Label htmlFor="lab-fees" className="cursor-pointer">Lab fees included?</Label>
              </div>
              {hasLabFees && (
                <div className="pl-6 space-y-2">
                  {labEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={entry.labId} onValueChange={(v) => updateLabEntry(i, 'labId', v)}>
                        <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select lab" /></SelectTrigger>
                        <SelectContent>
                          {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min="0" step="0.01" placeholder="Amount" value={entry.amount} onChange={(e) => updateLabEntry(i, 'amount', e.target.value)} className="w-28 h-9" />
                      {labEntries.length > 1 && (
                        <button type="button" onClick={() => removeLabEntry(i)}><Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" /></button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addLabEntry} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add another lab
                  </button>
                  {totalLabFees > 0 && <p className="text-xs text-muted-foreground">Total lab fees: <strong>{formatCurrency(totalLabFees)}</strong></p>}
                </div>
              )}
            </div>

            {/* ── Description ── */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Notes (optional)</Label>
              <Input id="description" placeholder="Any notes about this visit..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(successRoute)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? 'Saving...' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
