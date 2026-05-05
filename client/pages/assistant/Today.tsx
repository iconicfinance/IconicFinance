import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader, AlertTriangle, TrendingUp, CreditCard, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaymentMethodIcon } from '@/components/PaymentMethodIcon';
import { getTodayTransactions, Transaction } from '@/services/transactions';
import { formatCurrency, formatTime, formatPaymentMethod } from '@/lib/utils';

export default function AssistantToday() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTodayTransactions();
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const payments = transactions.filter((t) => t.type === 'payment_in');
  const cash = payments.filter((t) => t.payment_method === 'cash').reduce((s, t) => s + Number(t.final_amount), 0);
  const vodafone = payments.filter((t) => t.payment_method === 'vodafone_cash').reduce((s, t) => s + Number(t.final_amount), 0);
  const instapay = payments.filter((t) => t.payment_method === 'instapay').reduce((s, t) => s + Number(t.final_amount), 0);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Today's Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cash</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(cash)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payments.filter((t) => t.payment_method === 'cash').length} transactions
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
                <p className="text-sm font-medium text-muted-foreground">Vodafone Cash</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(vodafone)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payments.filter((t) => t.payment_method === 'vodafone_cash').length} transactions (incl. 1%)
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
                <p className="text-sm font-medium text-muted-foreground">Instapay</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(instapay)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payments.filter((t) => t.payment_method === 'instapay').length} transactions
                </p>
              </div>
              <PaymentMethodIcon method="instapay" size={44} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            All Transactions
            <Badge variant="secondary" className="ml-auto">{transactions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No transactions recorded today yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: '650px', width: '100%' }}>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Patient</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Method</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Lab Fees</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                        tx.lab_fees_pending ? 'bg-amber-50 hover:bg-amber-100' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatTime(tx.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'payment_in' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Payment In</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Expense Out</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.patient_id && tx.patient_name ? (
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
                      <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'payment_in' ? (
                          tx.lab_fees_pending ? (
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Pending
                            </span>
                          ) : tx.has_lab_fees ? (
                            <span className="text-green-600">{formatCurrency(tx.lab_fees_amount)}</span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
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
          )}
        </CardContent>
      </Card>

      {/* Action Buttons — mobile: circular FABs above bottom nav; desktop: text buttons inline */}
      <div className="sm:flex sm:gap-3">
        {/* Desktop buttons (hidden on mobile) */}
        <button
          onClick={() => navigate('/assistant/add-payment')}
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
        >
          <CreditCard className="w-4 h-4" /> Add Payment
        </button>
        <button
          onClick={() => navigate('/assistant/add-expense')}
          className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-colors shadow-sm"
        >
          <Receipt className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Mobile FABs — fixed above bottom nav bar, side by side */}
      <div className="sm:hidden fixed bottom-20 right-4 flex flex-row gap-3 z-40">
        <button
          onClick={() => navigate('/assistant/add-expense')}
          className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-lg transition-colors active:scale-95"
          title="Add Expense"
        >
          <Receipt className="w-6 h-6" />
        </button>
        <button
          onClick={() => navigate('/assistant/add-payment')}
          className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center shadow-lg transition-colors active:scale-95"
          title="Add Payment"
        >
          <CreditCard className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
