import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, Loader, Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { searchPatients, getPatientById, getPatientTransactionsByDoctor, type Patient, type PatientTransaction } from '@/services/patients';
import { getOutstandingBalancesByDoctor, type PatientBalanceFull } from '@/services/patientBalance';
import { formatCurrency, formatDate, formatPaymentMethod } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DoctorPatients() {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const [outstanding, setOutstanding]           = useState<PatientBalanceFull[]>([]);
  const [outstandingLoading, setOutstandingLoading] = useState(true);

  const [query, setQuery]                       = useState('');
  const [results, setResults]                   = useState<Patient[]>([]);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [selectedPatient, setSelectedPatient]   = useState<Patient | null>(null);
  const [transactions, setTransactions]         = useState<PatientTransaction[]>([]);
  const [searchLoading, setSearchLoading]       = useState(false);
  const [txLoading, setTxLoading]               = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load doctor's outstanding balances
  useEffect(() => {
    if (!user?.doctor_id) { setOutstandingLoading(false); return; }
    getOutstandingBalancesByDoctor(user.doctor_id)
      .then(setOutstanding)
      .catch(() => {})
      .finally(() => setOutstandingLoading(false));
  }, [user?.doctor_id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-load patient passed via router state (from clicking a patient name in the dashboard)
  useEffect(() => {
    const state = location.state as { patientId?: string; patientName?: string } | null;
    if (state?.patientId && user?.doctor_id) {
      const autoLoad = async () => {
        try {
          const pat = await getPatientById(state.patientId!);
          if (pat) {
            setSelectedPatient(pat);
            setQuery(pat.full_name);
            setTxLoading(true);
            const data = await getPatientTransactionsByDoctor(pat.id, user.doctor_id!);
            setTransactions(data);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load patient');
        } finally {
          setTxLoading(false);
        }
      };
      autoLoad();
    }
  }, [location.state, user?.doctor_id]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await searchPatients(query);
        setResults(data);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [query]);

  const selectPatient = async (patient: Patient) => {
    if (!user?.doctor_id) return;
    setSelectedPatient(patient);
    setQuery(patient.full_name);
    setShowDropdown(false);
    setError(null);
    setTxLoading(true);
    try {
      const data = await getPatientTransactionsByDoctor(patient.id, user.doctor_id);
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedPatient(null);
    setTransactions([]);
    setQuery('');
  };

  const totalRevenue = transactions.reduce((s, t) => s + Number(t.final_amount), 0);
  const totalEarnings = transactions.reduce((s, t) => s + Number(t.doctor_earnings), 0);

  const totalOutstanding = outstanding.reduce((s, b) => s + (b.total_due - b.total_paid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('My Patients')}</h1>
        <p className="text-muted-foreground text-sm mt-1">Outstanding balances and patient search</p>
      </div>

      {/* ── Outstanding Balances (doctor's patients only) ── */}
      {(outstandingLoading || outstanding.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {t('Outstanding Balances')}
              {!outstandingLoading && (
                <Badge variant="outline" className="ml-auto text-amber-700 border-amber-300">
                  {outstanding.length} patients · {formatCurrency(totalOutstanding)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {outstandingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : (
              <div className="divide-y">
                {outstanding.map((b) => {
                  const remaining = b.total_due - b.total_paid;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/50 text-left"
                      onClick={() => selectPatient({ id: b.patient_id, patient_code: b.patient_code, full_name: b.patient_name, created_at: '', updated_at: '' })}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{b.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{b.patient_code}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-red-600">{formatCurrency(remaining)}</p>
                        <p className="text-xs text-muted-foreground">of {formatCurrency(b.total_due)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('Search...')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedPatient) clearSelection();
            }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="ps-9"
          />
          {searchLoading && (
            <Loader className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {results.map((p) => (
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
          </div>
        )}
        {query.length >= 2 && !searchLoading && results.length === 0 && !showDropdown && (
          <p className="text-sm text-muted-foreground mt-2">{t('No patients found.')}</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {selectedPatient && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">{selectedPatient.full_name}</h2>
              <p className="text-muted-foreground text-sm">{selectedPatient.patient_code}</p>
            </div>
            {!txLoading && (
              <div className="ml-auto flex gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('Total Revenue')}</p>
                  <p className="font-semibold">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('My Earnings')}</p>
                  <p className="font-semibold text-primary">{formatCurrency(totalEarnings)}</p>
                </div>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {t('Transaction History')}
                {!txLoading && <Badge variant="secondary" className="ml-auto">{transactions.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions found for this patient.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm" style={{ minWidth: '650px', width: '100%' }}>
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Date')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Method')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Lab Fees')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('My Earnings')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={`border-b last:border-0 hover:bg-muted/20 ${
                            tx.lab_fees_pending ? 'bg-amber-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {tx.lab_fees_pending ? (
                              <span className="flex items-center justify-end gap-1 text-amber-600 text-xs">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Pending
                              </span>
                            ) : tx.has_lab_fees ? (
                              formatCurrency(tx.lab_fees_amount)
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap">
                            {formatCurrency(tx.doctor_earnings)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.expense_description || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!selectedPatient && !query && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('Search for a patient above to view their history.')}</p>
        </div>
      )}
    </div>
  );
}
