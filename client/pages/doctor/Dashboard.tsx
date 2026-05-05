import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentMethodIcon } from '@/components/PaymentMethodIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { getTransactionsByDoctor, Transaction } from '@/services/transactions';
import { getConfirmedClosingsByDoctor, MonthlyClosing } from '@/services/monthlyClosings';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatPaymentMethod,
  formatMonth,
  MONTH_NAMES,
} from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.doctor_id) return;
    try {
      setLoading(true);
      setError(null);

      let from: Date;
      let to: Date;

      if (useCustomRange && customFrom && customTo) {
        from = new Date(customFrom);
        from.setHours(0, 0, 0, 0);
        to = new Date(customTo);
        to.setDate(to.getDate() + 1);
        to.setHours(0, 0, 0, 0);
      } else {
        from = new Date(year, month - 1, 1);
        to = new Date(year, month, 1);
      }

      const [txData, closingData] = await Promise.all([
        getTransactionsByDoctor(user.doctor_id, from, to),
        getConfirmedClosingsByDoctor(user.doctor_id),
      ]);
      setTransactions(txData);
      setClosings(closingData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.doctor_id, year, month, useCustomRange, customFrom, customTo]);

  useEffect(() => {
    load();
  }, [load]);

  const cash = transactions.filter((t) => t.payment_method === 'cash').reduce((s, t) => s + Number(t.final_amount), 0);
  const vodafoneRaw = transactions.filter((t) => t.payment_method === 'vodafone_cash').reduce((s, t) => s + Number(t.final_amount), 0);
  const vodafoneNet = Math.round((vodafoneRaw / 1.01) * 100) / 100;
  const instapay = transactions.filter((t) => t.payment_method === 'instapay').reduce((s, t) => s + Number(t.final_amount), 0);
  const totalEarnings = transactions.reduce((s, t) => s + Number(t.doctor_earnings), 0);

  if (!user?.doctor_id) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="font-medium">No doctor profile linked to your account.</p>
          <p className="text-sm text-muted-foreground">Please contact the administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('Dashboard')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back, {user.full_name}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : t('Refresh')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="custom-range"
                checked={useCustomRange}
                onChange={(e) => setUseCustomRange(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="custom-range" className="cursor-pointer">Custom date range</Label>
            </div>

            {!useCustomRange ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">{t('Month')}</Label>
                  <select
                    className="border rounded-md px-3 py-2 text-sm bg-background"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('Year')}</Label>
                  <select
                    className="border rounded-md px-3 py-2 text-sm bg-background"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Cash')}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(cash)}</p>
              </div>
              <PaymentMethodIcon method="cash" size={36} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Vodafone Cash')}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(vodafoneNet)}</p>
                <p className="text-xs text-muted-foreground mt-1">Net (after Vodafone fee)</p>
              </div>
              <PaymentMethodIcon method="vodafone_cash" size={40} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Instapay')}</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(instapay)}</p>
              </div>
              <PaymentMethodIcon method="instapay" size={40} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-primary">{t('My Earnings')}</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(totalEarnings)}</p>
            <p className="text-xs text-muted-foreground mt-1">After all deductions</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Payments
            <Badge variant="secondary" className="ml-auto">{transactions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No transactions in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: '700px', width: '100%' }}>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date / Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Patient')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Method')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Base')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Final')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Lab Fees')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('My Earnings')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                        tx.lab_fees_pending ? 'bg-amber-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(tx.created_at)}<br />
                        <span className="text-xs">{formatTime(tx.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.patient_id && tx.patient_name ? (
                          <button
                            type="button"
                            onClick={() => navigate('/doctor/patients', { state: { patientId: tx.patient_id, patientName: tx.patient_name } })}
                            className="text-primary underline-offset-2 hover:underline font-medium"
                          >
                            {tx.patient_name}
                          </button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(tx.base_amount)}</td>
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

      {/* Confirmed Monthly Closings */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Confirmed Monthly Closings</h2>
        {closings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No confirmed closings yet.</p>
        ) : (
          <div className="space-y-3">
            {closings.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold">{formatMonth(c.month, c.year)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                          Confirmed {c.confirmed_at ? formatDate(c.confirmed_at) : ''}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">{t('Total Revenue')}</p>
                        <p className="font-medium">{formatCurrency(c.total_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t('Lab Fees')}</p>
                        <p className="font-medium">{formatCurrency(c.total_lab_fees)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t('Gross Earnings')}</p>
                        <p className="font-medium">{formatCurrency(c.doctor_gross_earnings)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t('Amount to Pay (EGP)')}</p>
                        <p className="font-semibold text-primary">{formatCurrency(c.amount_to_pay)}</p>
                      </div>
                      {c.comment && (
                        <div className="col-span-2 sm:col-span-3">
                          <p className="text-muted-foreground text-xs">{t('Comment (optional)')}</p>
                          <p className="text-sm italic">{c.comment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
