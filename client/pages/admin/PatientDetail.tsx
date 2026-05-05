import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader, AlertTriangle, CheckCircle2, PenLine, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPatientById, type Patient } from '@/services/patients';
import { getTransactionsByDateRange, type Transaction } from '@/services/transactions';
import { getAllBalancesForPatient, getBalanceEvents, type PatientBalanceFull, type BalanceEvent } from '@/services/patientBalance';
import { getAllDoctors, type Doctor } from '@/services/doctors';
import { formatCurrency, formatDate, formatTime, formatPaymentMethod } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DoctorBalance extends PatientBalanceFull {
  events: BalanceEvent[];
}

export default function AdminPatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [patient, setPatient]       = useState<Patient | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doctors, setDoctors]       = useState<Doctor[]>([]);
  const [doctorBalances, setDoctorBalances] = useState<DoctorBalance[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const from = new Date('2000-01-01');
        const to   = new Date(); to.setDate(to.getDate() + 1);

        const [pat, allTx, docs, balances] = await Promise.all([
          getPatientById(patientId),
          getTransactionsByDateRange(from, to),
          getAllDoctors(),
          getAllBalancesForPatient(patientId),
        ]);

        setPatient(pat);
        setDoctors(docs);
        setTransactions(allTx.filter((t) => t.patient_id === patientId && t.type === 'payment_in'));

        // Load events for each doctor balance
        const withEvents = await Promise.all(
          balances.map(async (b) => {
            const events = await getBalanceEvents(patientId, b.doctor_id).catch(() => []);
            return { ...b, events };
          })
        );
        setDoctorBalances(withEvents);
      } catch (err: any) {
        setError(err.message || 'Failed to load patient data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  const getDoctorName = (id: string | null) => doctors.find((d) => d.id === id)?.name || '—';
  const totalRevenue  = transactions.reduce((s, t) => s + Number(t.final_amount), 0);

  const eventIcon = (type: BalanceEvent['event_type']) => {
    if (type === 'balance_created') return <PenLine className="w-3.5 h-3.5 text-blue-500" />;
    if (type === 'total_updated')   return <PenLine className="w-3.5 h-3.5 text-orange-500" />;
    return <CreditCard className="w-3.5 h-3.5 text-green-600" />;
  };

  const eventLabel = (ev: BalanceEvent): string => {
    if (ev.event_type === 'balance_created')
      return `Balance created — Total: ${formatCurrency(ev.new_total ?? 0)}, Paid: ${formatCurrency(ev.payment_amount ?? 0)}`;
    if (ev.event_type === 'total_updated')
      return `Total updated: ${formatCurrency(ev.old_total ?? 0)} → ${formatCurrency(ev.new_total ?? 0)}`;
    return `Payment of ${formatCurrency(ev.payment_amount ?? 0)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1 icon-flip-rtl" /> {t('Back')}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t('Patient Detail')}</h1>
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
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{t('Total Visits')}</p>
                <p className="text-2xl font-bold mt-1">{transactions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{t('Total Paid')}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
              </CardContent>
            </Card>
            {doctorBalances.filter((b) => !b.is_settled).length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-amber-700">Outstanding</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {formatCurrency(doctorBalances.filter(b => !b.is_settled).reduce((s, b) => s + b.total_due - b.total_paid, 0))}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Balance timelines per doctor ── */}
          {doctorBalances.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">{t('Payment Balance')}</h2>
              {doctorBalances.map((b) => {
                const remaining = b.total_due - b.total_paid;
                return (
                  <Card key={b.id} className={b.is_settled ? 'border-green-200' : 'border-amber-200'}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm font-semibold">{b.doctor_name}</CardTitle>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>Total: <strong>{formatCurrency(b.total_due)}</strong></span>
                            <span>Paid: <strong className="text-green-600">{formatCurrency(b.total_paid)}</strong></span>
                            <span>{t('Remaining')}: <strong className={remaining > 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(remaining)}</strong></span>
                          </div>
                        </div>
                        {b.is_settled ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Settled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 flex-shrink-0">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Outstanding
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    {/* Timeline */}
                    {b.events.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="border-t pt-3 space-y-0">
                          {b.events.map((ev, idx) => (
                            <div key={ev.id} className="flex gap-3">
                              {/* Vertical line */}
                              <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-white border-2 border-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {eventIcon(ev.event_type)}
                                </div>
                                {idx < b.events.length - 1 && <div className="w-0.5 bg-muted flex-1 my-1" />}
                              </div>

                              {/* Content */}
                              <div className="pb-4 flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{eventLabel(ev)}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</span>
                                  {ev.new_remaining !== null && (
                                    <span className={`text-xs font-medium ${ev.new_remaining <= 0 ? 'text-green-600' : 'text-amber-700'}`}>
                                      {ev.new_remaining <= 0 ? t('Fully paid ✓') : `${t('Remaining')}: ${formatCurrency(ev.new_remaining)}`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── All Transactions ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {t('All Transactions')}
                <Badge variant="secondary" className="ml-auto">{transactions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No transactions found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-sm" style={{ minWidth: '800px', width: '100%' }}>
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Doctor')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Method')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Base')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Final')}</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Lab Fees')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Recorded By')}</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className={`border-b last:border-0 hover:bg-muted/20 ${tx.lab_fees_pending ? 'bg-amber-50' : ''}`}>
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
                                <AlertTriangle className="w-3 h-3" /> Pending
                              </span>
                            ) : tx.has_lab_fees ? formatCurrency(tx.lab_fees_amount) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">{tx.assistant_name}</td>
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
