import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader, Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { searchPatients, getPatientTransactions, type Patient, type PatientTransaction } from '@/services/patients';
import { getAllOutstandingBalances, type PatientBalanceFull } from '@/services/patientBalance';
import { formatCurrency, formatDate, formatPaymentMethod } from '@/lib/utils';

export default function AssistantPatients() {
  const [outstanding, setOutstanding]       = useState<PatientBalanceFull[]>([]);
  const [outstandingLoading, setOutstandingLoading] = useState(true);

  const [query, setQuery]                   = useState('');
  const [results, setResults]               = useState<Patient[]>([]);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [transactions, setTransactions]     = useState<PatientTransaction[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [txLoading, setTxLoading]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const dropdownRef   = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load outstanding balances on mount
  useEffect(() => {
    getAllOutstandingBalances()
      .then(setOutstanding)
      .catch(() => {})
      .finally(() => setOutstandingLoading(false));
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setShowDropdown(false); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try { setResults(await searchPatients(query)); setShowDropdown(true); }
      catch { setResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  }, [query]);

  const selectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setQuery(patient.full_name);
    setShowDropdown(false);
    setError(null);
    setTxLoading(true);
    try {
      setTransactions(await getPatientTransactions(patient.id));
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  };

  const clearSelection = () => { setSelectedPatient(null); setTransactions([]); setQuery(''); };

  const totalRevenue   = transactions.reduce((s, t) => s + Number(t.final_amount), 0);
  const totalOutstanding = outstanding.reduce((s, b) => s + (b.total_due - b.total_paid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-muted-foreground text-sm mt-1">Outstanding balances and patient search</p>
      </div>

      {/* ── Outstanding Balances Summary ── */}
      {(outstandingLoading || outstanding.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Outstanding Balances
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
                    <div
                      key={b.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50/50 cursor-pointer"
                      onClick={() => selectPatient({ id: b.patient_id, patient_code: b.patient_code, full_name: b.patient_name, created_at: '', updated_at: '' })}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{b.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{b.patient_code} · {b.doctor_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-red-600">{formatCurrency(remaining)}</p>
                        <p className="text-xs text-muted-foreground">remaining</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Patient Search ── */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patient by name or code..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (selectedPatient) clearSelection(); }}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="pl-9"
          />
          {searchLoading && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {results.map((p) => (
              <button key={p.id} type="button" className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b last:border-0" onClick={() => selectPatient(p)}>
                <p className="font-medium text-sm">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.patient_code}</p>
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && !searchLoading && results.length === 0 && !showDropdown && (
          <p className="text-sm text-muted-foreground mt-2">No patients found.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── Selected Patient Detail ── */}
      {selectedPatient && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold">{selectedPatient.full_name}</h2>
              <p className="text-muted-foreground text-sm">{selectedPatient.patient_code}</p>
            </div>
            {!txLoading && transactions.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-semibold">{formatCurrency(totalRevenue)}</p>
              </div>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Payment History
                {!txLoading && <Badge variant="secondary" className="ml-auto">{transactions.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 animate-spin text-primary" /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No transactions found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm" style={{ minWidth: '550px', width: '100%' }}>
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Method</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lab Fees</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {tx.has_lab_fees ? formatCurrency(tx.lab_fees_amount) : '—'}
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

      {!selectedPatient && !query && outstanding.length === 0 && !outstandingLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Search for a patient above to view their history.</p>
        </div>
      )}
    </div>
  );
}
