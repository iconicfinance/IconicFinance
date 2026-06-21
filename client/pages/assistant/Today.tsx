import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader, AlertTriangle, TrendingUp, Banknote, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaymentMethodIcon } from '@/components/PaymentMethodIcon';
import { getTodayTransactions, getTransactionsByDateRange, type Transaction } from '@/services/transactions';
import { getActiveDoctors, getDoctorDisplayName, type Doctor } from '@/services/doctors';
import { getBalancesForPatientDoctorPairs, type PatientBalance } from '@/services/patientBalance';
import { formatCurrency, formatDate, formatTime, formatPaymentMethod } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const PAGE_SIZE = 30;

export default function AssistantToday() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Today's transactions — used for summary cards only
  const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
  const [doctors, setDoctors]                     = useState<Doctor[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState<string | null>(null);

  // Table shows last 30 days with pagination
  const [tableTransactions, setTableTransactions] = useState<Transaction[]>([]);
  const [tableOffset, setTableOffset]             = useState(0);
  const [tableHasMore, setTableHasMore]           = useState(false);
  const [tableLoadingMore, setTableLoadingMore]   = useState(false);
  const [balanceMap, setBalanceMap]               = useState<Map<string, PatientBalance>>(new Map());

  const getTableRange = () => {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  };

  const getDoctorName = (id: string | null) => {
    const d = doctors.find((d) => d.id === id);
    return d ? getDoctorDisplayName(d) : '—';
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setTableOffset(0);
    const { from, to } = getTableRange();

    const [todayResult, tableResult, docResult] = await Promise.allSettled([
      getTodayTransactions(),
      getTransactionsByDateRange(from, to, { limit: PAGE_SIZE }),
      getActiveDoctors(),
    ]);

    if (todayResult.status === 'fulfilled') setTodayTransactions(todayResult.value);
    if (tableResult.status === 'fulfilled') {
      setTableTransactions(tableResult.value);
      setTableHasMore(tableResult.value.length === PAGE_SIZE);
    } else {
      setError((tableResult.reason as any)?.message || 'Failed to load transactions');
    }
    if (docResult.status === 'fulfilled') setDoctors(docResult.value);

    setLoading(false);
  };

  const handleLoadMore = async () => {
    if (tableLoadingMore) return;
    setTableLoadingMore(true);
    const newOffset = tableOffset + PAGE_SIZE;
    const { from, to } = getTableRange();
    try {
      const more = await getTransactionsByDateRange(from, to, { limit: PAGE_SIZE, offset: newOffset });
      setTableTransactions((prev) => [...prev, ...more]);
      setTableOffset(newOffset);
      setTableHasMore(more.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e.message || 'Failed to load more');
    } finally {
      setTableLoadingMore(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    getBalancesForPatientDoctorPairs(
      tableTransactions.map((tx) => ({ patient_id: tx.patient_id, doctor_id: tx.doctor_id }))
    ).then(setBalanceMap).catch(() => {});
  }, [tableTransactions]);

  const getBalanceFor = (tx: Transaction) =>
    tx.patient_id && tx.doctor_id ? balanceMap.get(`${tx.patient_id}_${tx.doctor_id}`) : undefined;

  // Summary cards — TODAY only
  const payments  = todayTransactions.filter((tx) => tx.type === 'payment_in');
  const cash      = payments.filter((tx) => tx.payment_method === 'cash').reduce((s, tx) => s + Number(tx.final_amount), 0);
  const vodafone  = payments.filter((tx) => tx.payment_method === 'vodafone_cash').reduce((s, tx) => s + Number(tx.final_amount), 0);
  const instapay  = payments.filter((tx) => tx.payment_method === 'instapay').reduce((s, tx) => s + Number(tx.final_amount), 0);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("Today's Transactions")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : t('Refresh')}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Summary Cards — today only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Cash')}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(cash)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payments.filter((tx) => tx.payment_method === 'cash').length} transactions
                </p>
              </div>
              <PaymentMethodIcon method="cash" size={40} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Vodafone Cash')}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(vodafone)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payments.filter((tx) => tx.payment_method === 'vodafone_cash').length} transactions
                </p>
              </div>
              <PaymentMethodIcon method="vodafone_cash" size={44} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Instapay')}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(instapay)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payments.filter((tx) => tx.payment_method === 'instapay').length} transactions
                </p>
              </div>
              <PaymentMethodIcon method="instapay" size={44} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table — last 30 days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {t('All Transactions')}
            <span className="text-xs text-muted-foreground font-normal ms-1">(last 30 days)</span>
            <Badge variant="secondary" className="ms-auto">{tableTransactions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <span className="ms-2 text-muted-foreground">{t('Loading...')}</span>
            </div>
          ) : tableTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('No transactions in the last 30 days.')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm" style={{ minWidth: '950px', width: '100%' }}>
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Date')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Time')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Type')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Patient')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Doctor')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Method')}</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Paid')}</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Total')}</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Remaining')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Lab Fees')}</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Notes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                          tx.lab_fees_pending ? 'bg-amber-50 hover:bg-amber-100' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatTime(tx.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.type === 'payment_in' ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{t('Payment In')}</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{t('Expense Out')}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.patient_name ? (
                            <Link
                              to="/assistant/history"
                              state={{ patientName: tx.patient_name }}
                              className="text-primary underline-offset-2 hover:underline font-medium"
                            >
                              {tx.patient_name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {tx.type === 'payment_in' ? getDoctorName(tx.doctor_id) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {getBalanceFor(tx) ? formatCurrency(getBalanceFor(tx)!.total_due) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {getBalanceFor(tx) ? formatCurrency(getBalanceFor(tx)!.total_due - getBalanceFor(tx)!.total_paid) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.type === 'payment_in' ? (
                            tx.lab_fees_pending ? (
                              <span className="flex items-center gap-1 text-amber-600 font-medium">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {t('Pending')}
                              </span>
                            ) : tx.has_lab_fees ? (
                              <span className="text-green-600">{formatCurrency(tx.lab_fees_amount)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.expense_description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {tableHasMore && (
                <div className="flex justify-center py-4 border-t">
                  <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={tableLoadingMore}>
                    {tableLoadingMore ? (
                      <><Loader className="w-4 h-4 me-2 animate-spin" /> {t('Loading...')}</>
                    ) : (
                      t('Load 30 more')
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Desktop buttons */}
      <div className="sm:flex sm:gap-3">
        <button
          onClick={() => navigate('/assistant/add-payment')}
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Banknote className="w-4 h-4" /> {t('Add Payment')}
        </button>
        <button
          onClick={() => navigate('/assistant/add-expense')}
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-colors shadow-sm"
        >
          <ShoppingBag className="w-4 h-4" /> {t('Add Expense')}
        </button>
      </div>

      {/* Mobile FABs */}
      <div className="sm:hidden fixed bottom-20 end-4 flex flex-row gap-3 z-40">
        <button
          onClick={() => navigate('/assistant/add-expense')}
          className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-lg transition-colors active:scale-95"
          title={t('Add Expense')}
        >
          <ShoppingBag className="w-6 h-6" />
        </button>
        <button
          onClick={() => navigate('/assistant/add-payment')}
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center shadow-lg transition-colors active:scale-95"
          title={t('Add Payment')}
        >
          <Banknote className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
