import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, AlertTriangle, Pencil, CalendarPlus } from 'lucide-react';
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
import { getTransactionsByDateRange, updateLabFees, Transaction } from '@/services/transactions';
import { getAllDoctors, Doctor } from '@/services/doctors';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatPaymentMethod,
  MONTH_NAMES,
} from '@/lib/utils';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => now.toISOString().split('T')[0]);
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [labFeeModal, setLabFeeModal] = useState<Transaction | null>(null);
  const [labFeeInput, setLabFeeInput] = useState('');
  const [savingLabFee, setSavingLabFee] = useState(false);
  const [labFeeError, setLabFeeError] = useState('');

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!fromDate || !toDate) return;
    try {
      setLoading(true);
      setError(null);
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setDate(to.getDate() + 1);
      to.setHours(0, 0, 0, 0);

      const [txData, docData] = await Promise.all([
        getTransactionsByDateRange(from, to),
        getAllDoctors(),
      ]);
      setTransactions(txData);
      setDoctors(docData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

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
    setLabFeeInput('');
    setLabFeeError('');
  };

  const saveLabFee = async () => {
    if (!labFeeModal) return;
    const amount = parseFloat(labFeeInput);
    if (!labFeeInput || amount <= 0) {
      setLabFeeError('Please enter a valid amount.');
      return;
    }
    setSavingLabFee(true);
    setLabFeeError('');
    try {
      const updated = await updateLabFees(labFeeModal.id, amount);
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
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Financial overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setAddModalOpen(true)}>
            <CalendarPlus className="w-4 h-4 mr-1.5" /> Add Transaction
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Refresh'}
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
              <Label className="text-xs">Doctor</Label>
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
              <Label className="text-xs">Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                  <SelectItem value="instapay">Instapay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={load} disabled={loading}>Apply</Button>
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
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">Total Revenue</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-green-800">{formatCurrency(totalRevenue)}</p></CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Total Expenses</CardTitle></CardHeader>
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
                <p className="text-sm text-muted-foreground">Cash</p>
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
                <p className="text-sm text-muted-foreground">Vodafone Cash</p>
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
                <p className="text-sm text-muted-foreground">Instapay</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(instapayTotal)}</p>
              </div>
              <PaymentMethodIcon method="instapay" size={40} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Lab Fees Collected</CardTitle></CardHeader>
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
            All Transactions
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
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: '1100px', width: '100%' }}>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Patient</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Doctor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Method</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Base</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Final</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lab Fees</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Dr. Earnings</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Recorded By</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
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
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(tx.base_amount)}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
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
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditingTx(tx); }}
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit transaction"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <p><span className="text-muted-foreground">Patient:</span> {labFeeModal.patient_name}</p>
                <p><span className="text-muted-foreground">Final Amount:</span> {formatCurrency(labFeeModal.final_amount)}</p>
                <p><span className="text-muted-foreground">Date:</span> {formatDate(labFeeModal.created_at)}</p>
              </div>
              {labFeeError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-600">
                  {labFeeError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Lab Fees Amount (EGP) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={labFeeInput}
                  onChange={(e) => setLabFeeInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabFeeModal(null)}>Cancel</Button>
            <Button onClick={saveLabFee} disabled={savingLabFee}>
              {savingLabFee && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {savingLabFee ? 'Saving...' : 'Save Lab Fees'}
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
