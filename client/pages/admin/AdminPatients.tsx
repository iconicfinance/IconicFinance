import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { searchPatients, type Patient } from '@/services/patients';
import { getAllOutstandingBalances, getBalancesForPatientIds, type PatientBalanceFull, type PatientBalance } from '@/services/patientBalance';
import { formatCurrency } from '@/lib/utils';

interface PatientWithBalance extends Patient {
  balance?: PatientBalance & { doctor_name: string };
}

export default function AdminPatients() {
  const navigate = useNavigate();
  const [outstanding, setOutstanding]     = useState<PatientBalanceFull[]>([]);
  const [searchResults, setSearchResults] = useState<PatientWithBalance[]>([]);
  const [loadingInit, setLoadingInit]     = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError]                 = useState('');
  const [query, setQuery]                 = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    getAllOutstandingBalances()
      .then(setOutstanding)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoadingInit(false));
  }, []);

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const patients = await searchPatients(query);
        const balanceMap = await getBalancesForPatientIds(patients.map((p) => p.id));
        setSearchResults(
          patients.map((p) => ({ ...p, balance: balanceMap.get(p.id) }))
        );
      } catch (e: any) {
        setError(e.message || 'Search failed');
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [query]);

  const totalOutstanding = outstanding.reduce((s, b) => s + (b.total_due - b.total_paid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-muted-foreground text-sm mt-1">Search all patients or view outstanding balances</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Search — searches ALL patients */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search all patients by name or code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {searchLoading && (
          <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search results */}
      {query.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Search Results
              {searchResults.length > 0 && (
                <Badge variant="secondary" className="ml-2">{searchResults.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {searchResults.length === 0 && !searchLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">No patients found.</p>
            ) : (
              <div className="divide-y">
                {searchResults.map((p) => {
                  const remaining = p.balance ? p.balance.total_due - p.balance.total_paid : 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/admin/patients/${p.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                      </div>
                      {p.balance ? (
                        <div className="text-right flex-shrink-0">
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-xs">
                            Due: {formatCurrency(remaining)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.balance.doctor_name}</p>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">No balance</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Outstanding balances — shown when not searching */}
      {query.length < 2 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Patients with Balance</p>
                <p className="text-2xl font-bold text-amber-600">{outstanding.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Outstanding Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingInit ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : outstanding.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No outstanding balances.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 520 }}>
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Patient</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Doctor</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Paid</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.map((b) => {
                        const remaining = b.total_due - b.total_paid;
                        return (
                          <tr
                            key={b.id}
                            className="border-b hover:bg-muted/30 cursor-pointer"
                            onClick={() => navigate(`/admin/patients/${b.patient_id}`)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-medium">{b.patient_name}</p>
                              <p className="text-xs text-muted-foreground">{b.patient_code}</p>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.doctor_name}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(b.total_due)}</td>
                            <td className="px-4 py-3 text-right text-green-600 whitespace-nowrap">{formatCurrency(b.total_paid)}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className="font-semibold text-red-600">{formatCurrency(remaining)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
