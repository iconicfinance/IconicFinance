import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, CheckCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { searchPatients, createPatient, Patient } from '@/services/patients';
import { getActiveDoctors, Doctor } from '@/services/doctors';
import { createPaymentIn } from '@/services/transactions';
import { formatCurrency } from '@/lib/utils';

export default function AssistantAddPayment() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const successRoute =
    user?.role === 'admin' ? '/admin/dashboard'
    : user?.role === 'doctor' ? '/doctor/dashboard'
    : '/assistant/today';

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creatingNewPatient, setCreatingNewPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientCode, setNewPatientCode] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vodafone_cash' | 'instapay' | ''>('');
  const [hasLabFees, setHasLabFees] = useState(false);
  const [labFeesAmount, setLabFeesAmount] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    getActiveDoctors().then(setDoctors).catch(console.error);
  }, []);

  useEffect(() => {
    if (patientQuery.length < 2) {
      setPatientResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchPatients(patientQuery);
        setPatientResults(results);
        setShowDropdown(true);
      } catch {
        setPatientResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [patientQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientQuery(patient.full_name);
    setShowDropdown(false);
    setCreatingNewPatient(false);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientQuery('');
    setCreatingNewPatient(false);
    setNewPatientName('');
    setNewPatientCode('');
  };

  const startNewPatient = () => {
    setSelectedPatient(null);
    setCreatingNewPatient(true);
    setShowDropdown(false);
  };

  const baseAmountNum = parseFloat(baseAmount) || 0;
  const finalAmount =
    paymentMethod === 'vodafone_cash'
      ? Math.round(baseAmountNum * 1.01 * 100) / 100
      : baseAmountNum;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      let patientId = selectedPatient?.id || '';
      let patientName = selectedPatient?.full_name || '';

      if (creatingNewPatient) {
        if (!newPatientName.trim() || !newPatientCode.trim()) {
          setError('Patient name and code are required.');
          setLoading(false);
          return;
        }
        const newPat = await createPatient({
          full_name: newPatientName.trim(),
          patient_code: newPatientCode.trim(),
        });
        patientId = newPat.id;
        patientName = newPat.full_name;
      }

      if (!patientId) {
        setError('Please select or create a patient.');
        setLoading(false);
        return;
      }
      if (!selectedDoctorId) {
        setError('Please select a doctor.');
        setLoading(false);
        return;
      }
      if (!paymentMethod) {
        setError('Please select a payment method.');
        setLoading(false);
        return;
      }
      if (!baseAmount || baseAmountNum <= 0) {
        setError('Please enter a valid amount.');
        setLoading(false);
        return;
      }

      await createPaymentIn({
        assistant_id: user.id,
        assistant_name: user.full_name,
        patient_id: patientId,
        patient_name: patientName,
        doctor_id: selectedDoctorId,
        payment_method: paymentMethod,
        base_amount: baseAmountNum,
        final_amount: finalAmount,
        has_lab_fees: hasLabFees,
        lab_fees_amount: hasLabFees && labFeesAmount ? parseFloat(labFeesAmount) : null,
        expense_description: description.trim() || null,
      });

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
        <p className="text-muted-foreground">Redirecting to today's view...</p>
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
        <CardHeader>
          <CardTitle className="text-base">Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Patient Search */}
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
              ) : creatingNewPatient ? (
                <div className="space-y-3 p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <p className="text-sm font-medium text-blue-700">New Patient</p>
                  <Input
                    placeholder="Patient Full Name *"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                  />
                  <Input
                    placeholder="Patient Code (e.g. P-0042) *"
                    value={newPatientCode}
                    onChange={(e) => setNewPatientCode(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={clearPatient}
                    className="text-xs text-blue-600 underline"
                  >
                    Cancel — search instead
                  </button>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or patient code..."
                      value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)}
                      onFocus={() => patientResults.length > 0 && setShowDropdown(true)}
                      className="pl-9"
                    />
                    {searchLoading && (
                      <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {showDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {patientResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-0"
                          onClick={() => selectPatient(p)}
                        >
                          <p className="font-medium text-sm">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-blue-600 text-sm font-medium"
                        onClick={startNewPatient}
                      >
                        + Create new patient
                      </button>
                    </div>
                  )}
                  {patientQuery.length >= 2 && !searchLoading && !showDropdown && patientResults.length === 0 && (
                    <button
                      type="button"
                      className="text-sm text-blue-600 underline mt-2"
                      onClick={startNewPatient}
                    >
                      No results — create new patient
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Doctor */}
            <div className="space-y-2">
              <Label>Doctor *</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{' '}
                      ({d.type === 'custom'
                        ? d.custom_label || 'Custom'
                        : d.type.charAt(0).toUpperCase() + d.type.slice(1)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                  <SelectItem value="instapay">Instapay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Base Amount (EGP) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
              />
              {paymentMethod === 'vodafone_cash' && baseAmountNum > 0 && (
                <p className="text-sm text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                  Total + 1% = <span className="font-bold">{formatCurrency(finalAmount)}</span>
                </p>
              )}
            </div>

            {/* Lab Fees */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lab-fees"
                  checked={hasLabFees}
                  onCheckedChange={(v) => {
                    setHasLabFees(!!v);
                    if (!v) setLabFeesAmount('');
                  }}
                />
                <Label htmlFor="lab-fees" className="cursor-pointer">Lab fees included?</Label>
              </div>
              {hasLabFees && (
                <div className="pl-6 space-y-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Lab fees amount (leave blank to fill later)"
                    value={labFeesAmount}
                    onChange={(e) => setLabFeesAmount(e.target.value)}
                  />
                  <p className="text-xs text-amber-600">
                    Leave blank to save with pending warning — admin can enter later.
                  </p>
                </div>
              )}
            </div>

            {/* Optional Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Any notes about this visit..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(successRoute)}
                className="flex-1"
              >
                Cancel
              </Button>
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
