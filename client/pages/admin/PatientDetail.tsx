import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById } from '@/services/patients';
import { getTransactionsByDateRange, Transaction } from '@/services/transactions';
import { Patient } from '@/services/patients';
import { formatCurrency, formatDate, formatTime, formatPaymentMethod } from '@/lib/utils';
import { getAllDoctors, Doctor } from '@/services/doctors';

export default function AdminPatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all-time transactions by fetching a wide date range
        const from = new Date('2000-01-01');
        const to = new Date();
        to.setDate(to.getDate() + 1);

        const [pat, allTx, docs] = await Promise.all([
          getPatientById(patientId),
          getTransactionsByDateRange(from, to),
          getAllDoctors(),
        ]);

        setPatient(pat);
        setDoctors(docs);
        // Filter to this patient's payment_in transactions
        setTransactions(allTx.filter((t) => t.patient_id === patientId && t.type === 'payment_in'));
      } catch (err: any) {
        setError(err.message || 'Failed to load patient data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  const getDoctorName = (id: string | null) => doctors.find((d) => d.id === id)?.name || '—';

  const totalRevenue = transactions.reduce((s, t) => s + Number(t.final_amount), 0);
  const totalEarnings = transactions.reduce((s, t) => s + Number(t.doctor_earnings), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Patient Detail</h1>
          {patient && (
            <p className="text-muted-foreground text-sm mt-0.5">
              {patient.full_name} · <span className="font-mono">{patient.patient_code}</span>
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total Visits</p>
                <p className="text-2xl font-bold mt-1">{transactions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total Dr. Earnings</p>
                <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalEarnings)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                All Transactions
                <Badge variant="secondary" className="ml-auto">{transactions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No transactions found for this patient.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm" style={{ minWidth: '850px', width: '100%' }}>
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Doctor</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Method</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Base</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Final</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lab Fees</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Dr. Earnings</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Recorded By</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={`border-b last:border-0 hover:bg-muted/20 ${tx.lab_fees_pending ? 'bg-amber-50' : ''}`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {formatDate(tx.created_at)}<br />
                            <span className="text-xs">{formatTime(tx.created_at)}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{getDoctorName(tx.doctor_id)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(tx.base_amount)}</td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {tx.lab_fees_pending ? (
                              <span className="flex items-center justify-end gap-1 text-amber-600 text-xs">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Pending
                              </span>
                            ) : tx.has_lab_fees ? formatCurrency(tx.lab_fees_amount) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap">
                            {formatCurrency(tx.doctor_earnings)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                            {tx.assistant_name}
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
        </>
      )}
    </div>
  );
}
