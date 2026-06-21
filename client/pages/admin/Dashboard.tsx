import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, AlertTriangle, Pencil, Trash2, CalendarPlus, Plus } from 'lucide-react';
import { PaymentMethodIcon } from '@/components/PaymentMethodIcon';
import { EditTransactionModal } from './EditTransactionModal';
import { AddTransactionModal } from './AddTransactionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTransactionsByDateRange, updateLabFees, deleteTransaction, type Transaction } from '@/services/transactions';
import { getBalancesForPatientDoctorPairs, type PatientBalance } from '@/services/patientBalance';
import { getActiveLabs, type Lab } from '@/services/labs';
import { saveLabFeesForTransaction } from '@/services/transactionLabFees';

const PAGE_SIZE = 30;
import { getAllDoctors, Doctor } from '@/services/doctors';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatPaymentMethod,
} from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const now = new Date();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => now.toISOString().split('T')[0]);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [balanceMap, setBalanceMap]     = useState<Map<string, PatientBalance>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [txOffset, setTxOffset]         = useState(0);
  const [hasMore, setHasMore]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);

  const [labFeeModal, setLabFeeModal] = useState<Transaction | null>(null);
  const [labFeeEntries, setLabFeeEntries] = useState<{ labId: string; amount: string }[]>([{ labId: '', amount: '' }]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [savingLabFee, setSavingLabFee] = useState(false);
  const [labFeeError, setLabFeeError] = useState('');

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const buildRange = () => {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setDate(to.getDate() + 1);
    to.setHours(0, 0, 0, 0);
    return { from, to };
  };

  // Paginated load — used on mount and Refresh button
  const load = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    setTxOffset(0);
    try {
      const { from, to } = buildRange();
      const [txData, docData] = await Promise.all([
        getTransactionsByDateRange(from, to, { limit: PAGE_SIZE }),
        getAllDoctors(),
      ]);
      setTransactions(txData);
      setDoctors(docData);
      setHasMore(txData.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load all — used by Apply filter button (shows every record for the period)
  const applyFilter = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    setTxOffset(0);
    setHasMore(false);
    try {
      const { from, to } = buildRange();
      const [txData, docData] = await Promise.all([
        getTransactionsByDateRange(from, to), // no pagination limit
        getAllDoctors(),
      ]);
      setTransactions(txData);
      setDoctors(docData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Append next page
  const handleLoadMore = async () => {
    if (loadingMore || !fromDate || !toDate) return;
    setLoadingMore(true);
    const newOffset = txOffset + PAGE_SIZE;
    try {
      const { from, to } = buildRange();
      const more = await getTransactionsByDateRange(from, to, { limit: PAGE_SIZE, offset: newOffset });
      setTransactions((prev) => [...prev, ...more]);
      setTxOffset(newOffset);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getActiveLabs().then(setLabs).catch(() => {});
  }, []);

  useEffect(() => {
    getBalancesForPatientDoctorPairs(
      transactions.map((tx) => ({ patient_id: tx.patient_id, doctor_id: tx.doctor_id }))
    ).then(setBalanceMap).catch(() => {});
  }, [transactions]);

  const getBalanceFor = (tx: Transaction) =>
    tx.patient_id && tx.doctor_id ? balanceMap.get(`${tx.patient_id}_${tx.doctor_id}`) : undefined;

  const filtered = transactions.filter((tx) => {
    if (doctorFilter !== 'all' && tx.doctor_id !== doctorFilter) return false;
    if (methodFilter !== 'all' && tx.payment_method !== methodFilter) return false;
    return true;
  });

  const payments = filtered.filter((t) => t.type === 'payment_in');
  const expenses = filtered.filter((t) => t.type === 'expense_out');

  const totalRevenue = payments.reduce((s, t) => s + Number(t.final_amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.final_amount), 0);
  const netIncome = totalRevenue - totalExpenses;
  const cashTotal = payments.filter((t) => t.payment_method === 'cash').reduce((s, t) => s + Number(t.final_amount), 0);
  const vodafoneTotal = payments.filter((t) => t.payment_method === 'vodafone_cash').reduce((s, t) => s + Number(t.final_amount), 0);
  const instapayTotal = payments.filter((t) => t.payment_method === 'instapay').reduce((s, t) => s + Number(t.final_amount), 0);
  const labFeesTotal = payments.filter((t) => t.has_lab_fees && t.lab_fees_amount).reduce((s, t) => s + Number(t.lab_fees_amount), 0);
  const pendingCount = payments.filter((t) => t.lab_fees_pending).length;

  const getDoctorName = (id: string | null) => doctors.find((d) => d.id === id)?.name || '—';

  const openLabFeeModal = (tx: Transaction) => {
    setLabFeeModal(tx);
    setLabFeeEntries([{ labId: '', amount: '' }]);
    setLabFeeError('');
  };

  const addLabFeeEntry    = () => setLabFeeEntries((p) => [...p, { labId: '', amount: '' }]);
  const removeLabFeeEntry = (i: number) => setLabFeeEntries((p) => p.filter((_, idx) => idx !== i));
  const updateLabFeeEntry = (i: number, field: 'labId' | 'amount', val: string) =>
    setLabFeeEntries((p) => p.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));

  const saveLabFee = async () => {
    if (!labFeeModal) return;
    const validEntries = labFeeEntries.filter((e) => e.labId && parseFloat(e.amount) > 0);
    if (validEntries.length === 0) {
      setLabFeeError('Please select a lab and enter a valid amount.');
      return;
    }
    const total = validEntries.reduce((s, e) => s + parseFloat(e.amount), 0);
    setSavingLabFee(true);
    setLabFeeError('');
    try {
      await saveLabFeesForTransaction(
        labFeeModal.id,
        validEntries.map((e) => ({ lab_id: e.labId, amount: parseFloat(e.amount) }))
      );
      const updated = await updateLabFees(labFeeModal.id, total);
      setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setLabFeeModal(null);
    } catch (err: any) {
      setLabFeeError(err.message || 'Failed to save lab fees');
    } finally {
      setSavingLabFee(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('Dashboard')}</h1>
          <p className="text-muted-foreground text-sm mt-1">Financial overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <CalendarPlus className="w-4 h-4 mr-1.5" /> {t('Add Transaction')}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : t('Refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('Doctor')}</Label>
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('Method')}</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">{t('Cash')}</SelectItem>
                  <SelectItem value="vodafone_cash">{t('Vodafone Cash')}</SelectItem>
                  <SelectItem value="instapay">{t('Instapay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={applyFilter} disabled={loading}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">{t('Total Revenue')}</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-green-800">{formatCurrency(totalRevenue)}</p></CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">{t('Total Expenses')}</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-red-800">{formatCurrency(totalExpenses)}</p></CardContent>
        </Card>
        <Card className={`border-primary/20 ${netIncome >= 0 ? 'bg-primary/5' : 'bg-red-50'}`}>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Clinic Income</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${netIncome >= 0 ? 'text-primary' : 'text-red-600'}`}>
              {formatCurrency(netIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('Cash')}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(cashTotal)}</p>
              </div>
              <PaymentMethodIcon method="cash" size={36} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('Vodafone Cash')}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(vodafoneTotal)}</p>
              </div>
              <PaymentMethodIcon method="vodafone_cash" size={40} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('Instapay')}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(instapayTotal)}</p>
              </div>
              <PaymentMethodIcon method="instapay" size={40} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('Lab Fees')}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(labFeesTotal)}</p>
            {pendingCount > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3" /> {pendingCount} pending
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t('All Transactions')}
            <Badge variant="secondary" className="ml-auto">{filtered.length}</Badge>
            {pendingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                <AlertTriangle className="w-3 h-3 mr-1" /> {pendingCount} missing lab fees
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No transactions found.</div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: '1200px', width: '100%' }}>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Patient')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Doctor')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Method')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Paid')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Total')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Remaining')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Lab Fees')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Dr. Earnings</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Recorded By')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Notes')}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`border-b last:border-0 transition-colors ${
                        tx.lab_fees_pending
                          ? 'bg-amber-50 hover:bg-amber-100 cursor-pointer'
                          : 'hover:bg-muted/20'
                      }`}
                      onClick={tx.lab_fees_pending ? () => openLabFeeModal(tx) : undefined}
                      title={tx.lab_fees_pending ? 'Click to enter missing lab fees' : undefined}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(tx.created_at)}<br />
                        <span className="text-xs">{formatTime(tx.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'payment_in' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Payment In</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Expense Out</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.patient_id && tx.patient_name ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/patients/${tx.patient_id}`); }}
                            className="text-primary underline-offset-2 hover:underline font-medium"
                          >
                            {tx.patient_name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{getDoctorName(tx.doctor_id)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {getBalanceFor(tx) ? formatCurrency(getBalanceFor(tx)!.total_due) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {getBalanceFor(tx) ? formatCurrency(getBalanceFor(tx)!.total_due - getBalanceFor(tx)!.total_paid) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {tx.lab_fees_pending ? (
                          <span className="flex items-center justify-end gap-1 text-amber-600 font-medium text-xs whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Click to enter
                          </span>
                        ) : tx.has_lab_fees ? (
                          formatCurrency(tx.lab_fees_amount)
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary whitespace-nowrap">
                        {tx.type === 'payment_in' ? formatCurrency(tx.doctor_earnings) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        {tx.assistant_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.expense_description || '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit transaction"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeletingTx(tx); }}
                            className="p-1.5 rounded hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center py-4 border-t">
                <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <><Loader className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                  ) : (
                    'Load 30 more'
                  )}
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lab Fee Modal */}
      <Dialog open={!!labFeeModal} onOpenChange={(open) => !open && setLabFeeModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Missing Lab Fees</DialogTitle>
          </DialogHeader>
          {labFeeModal && (
            <div className="space-y-4 py-2">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">{t('Patient')}:</span> {labFeeModal.patient_name}</p>
                <p><span className="text-muted-foreground">Final Amount:</span> {formatCurrency(labFeeModal.final_amount)}</p>
                <p><span className="text-muted-foreground">{t('Date')}:</span> {formatDate(labFeeModal.created_at)}</p>
              </div>
              {labFeeError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-600">
                  {labFeeError}
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('Lab Fees')} *</Label>
                {labFeeEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={entry.labId} onValueChange={(v) => updateLabFeeEntry(i, 'labId', v)}>
                      <SelectTrigger className="flex-1 h-9"><SelectValue placeholder={t('Select lab')} /></SelectTrigger>
                      <SelectContent>
                        {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={entry.amount}
                      onChange={(e) => updateLabFeeEntry(i, 'amount', e.target.value)}
                      className="w-24 h-9"
                      autoFocus={i === 0}
                    />
                    {labFeeEntries.length > 1 && (
                      <button type="button" onClick={() => removeLabFeeEntry(i)}>
                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addLabFeeEntry} className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> {t('Add another lab')}
                </button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabFeeModal(null)}>{t('Cancel')}</Button>
            <Button onClick={saveLabFee} disabled={savingLabFee}>
              {savingLabFee && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {savingLabFee ? t('Saving...') : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTx} onOpenChange={(open) => { if (!open && !deleting) setDeletingTx(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
          </DialogHeader>
          {deletingTx && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete this transaction? This cannot be undone.
              </p>
              <div className="text-sm space-y-1 border rounded-lg p-3 bg-muted/30">
                <p><span className="text-muted-foreground">Patient:</span> {deletingTx.patient_name || '—'}</p>
                <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(deletingTx.final_amount)}</p>
                <p><span className="text-muted-foreground">Date:</span> {formatDate(deletingTx.created_at)}</p>
                <p><span className="text-muted-foreground">Doctor:</span> {getDoctorName(deletingTx.doctor_id)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTx(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deletingTx) return;
                setDeleting(true);
                try {
                  await deleteTransaction(deletingTx.id);
                  setTransactions((prev) => prev.filter((t) => t.id !== deletingTx.id));
                  setDeletingTx(null);
                } catch (err: any) {
                  setError(err.message || 'Failed to delete transaction');
                  setDeletingTx(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTx}
        onClose={() => setEditingTx(null)}
        onSaved={(updated) => {
          setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          setEditingTx(null);
        }}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        open={addModalOpen}
        defaultDate={fromDate || new Date().toISOString().split('T')[0]}
        onClose={() => setAddModalOpen(false)}
        onSaved={(tx) => {
          setTransactions((prev) => [tx, ...prev]);
          setAddModalOpen(false);
        }}
      />
    </div>
  );
}
