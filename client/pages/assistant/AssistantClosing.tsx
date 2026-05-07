import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Loader, CheckCircle, Lock, Unlock, Printer, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getMonthlySummary, getClosingsForMonth, getAllConfirmedClosings,
  saveClosing, confirmClosing, reopenClosing,
  type MonthlySummaryRow, type MonthlyClosing,
} from '@/services/monthlyClosings';
import { getTransactionsByDoctor } from '@/services/transactions';
import { formatCurrency, formatDate, MONTH_NAMES } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DoctorState {
  amountToPay: string;
  comment: string;
  saving: boolean;
  error: string;
}

export default function AssistantClosing() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [summary, setSummary]         = useState<MonthlySummaryRow[]>([]);
  const [closings, setClosings]       = useState<MonthlyClosing[]>([]);
  const [closingHistory, setClosingHistory] = useState<MonthlyClosing[]>([]);
  const [cardStates, setCardStates]   = useState<Record<string, DoctorState>>({});
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [printingId, setPrintingId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, closingData, historyData] = await Promise.all([
        getMonthlySummary(year, month),
        getClosingsForMonth(year, month),
        getAllConfirmedClosings(),
      ]);
      // Only show extern and custom doctors
      const filtered = sumData.filter((r) => r.doctor_type === 'extern' || r.doctor_type === 'custom');
      setSummary(filtered);
      setClosings(closingData);
      setClosingHistory(historyData.filter((h) => filtered.some((r) => r.doctor_id === h.doctor_id)));

      const states: Record<string, DoctorState> = {};
      filtered.forEach((row) => {
        const existing = closingData.find((c) => c.doctor_id === row.doctor_id);
        // If this closing was previously confirmed then reopened, default amount = delta only
        const wasReopened = existing?.confirmed_at != null && existing.is_confirmed === false;
        const delta = wasReopened
          ? Math.max(0, row.doctor_gross_earnings - (existing!.doctor_gross_earnings ?? 0))
          : 0;
        states[row.doctor_id] = {
          amountToPay: wasReopened
            ? delta.toString()
            : existing?.amount_to_pay?.toString() ?? row.doctor_gross_earnings.toString(),
          comment: existing?.comment ?? '',
          saving: false,
          error: '',
        };
      });
      setCardStates(states);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const updateState = (doctorId: string, patch: Partial<DoctorState>) =>
    setCardStates((prev) => ({ ...prev, [doctorId]: { ...prev[doctorId], ...patch } }));

  const handleConfirm = async (row: MonthlySummaryRow) => {
    if (!user) return;
    const state = cardStates[row.doctor_id];
    updateState(row.doctor_id, { saving: true, error: '' });
    try {
      // Upsert the closing record
      const closing = await saveClosing({
        month, year,
        doctor_id: row.doctor_id,
        case_count: row.case_count,
        total_revenue: row.total_revenue,
        total_lab_fees: row.total_lab_fees,
        doctor_gross_earnings: row.doctor_gross_earnings,
        clinic_remaining_share: null,
        amount_to_pay: parseFloat(state.amountToPay) || row.doctor_gross_earnings,
        comment: state.comment || null,
        is_confirmed: false,
      });

      // Confirm it — pass the actual logged-in user's ID (not an empty string)
      const confirmed = await confirmClosing(closing.id, user.id);

      setClosings((prev) => {
        const exists = prev.some((c) => c.doctor_id === row.doctor_id);
        return exists
          ? prev.map((c) => (c.doctor_id === row.doctor_id ? confirmed : c))
          : [...prev, confirmed];
      });
    } catch (e: any) {
      updateState(row.doctor_id, { error: e.message || 'Failed to save' });
    } finally {
      updateState(row.doctor_id, { saving: false });
    }
  };

  const handleReopen = async (row: MonthlySummaryRow) => {
    const closing = closings.find((c) => c.doctor_id === row.doctor_id);
    if (!closing) return;
    updateState(row.doctor_id, { saving: true, error: '' });
    try {
      const reopened = await reopenClosing(closing.id);
      setClosings((prev) => prev.map((c) => (c.id === reopened.id ? reopened : c)));
      // Default amount = only the new earnings since the last confirmed closing
      const delta = Math.max(0, row.doctor_gross_earnings - (closing.doctor_gross_earnings ?? 0));
      updateState(row.doctor_id, { amountToPay: delta.toString() });
    } catch (e: any) {
      updateState(row.doctor_id, { error: e.message || 'Failed to reopen' });
    } finally {
      updateState(row.doctor_id, { saving: false });
    }
  };

  const handlePrint = async (row: MonthlySummaryRow) => {
    setPrintingId(row.doctor_id);
    try {
      const from = new Date(year, month - 1, 1);
      const to   = new Date(year, month, 1);
      const txs  = await getTransactionsByDoctor(row.doctor_id, from, to);
      const state   = cardStates[row.doctor_id];
      const closing = closings.find((c) => c.doctor_id === row.doctor_id);
      const fmt = (n: number | null | undefined) =>
        n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const monthName = MONTH_NAMES[month - 1];
      const typeLabel = row.doctor_type === 'custom' ? (row.custom_label || 'Custom') : 'Extern';
      const pct = row.doctor_type === 'custom' ? (row.custom_percentage ?? 40) : 40;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Closing — ${row.doctor_name} — ${monthName} ${year}</title>
<style>
  body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:700px;margin:0 auto}
  h1{font-size:22px;margin-bottom:4px}
  h2{font-size:16px;color:#0078a8;margin:24px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
  th{background:#f0f9ff;padding:8px 10px;text-align:left;border:1px solid #bae6fd}
  td{padding:7px 10px;border:1px solid #e2e8f0}
  .right{text-align:right}
  .summary{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-top:24px}
  .row{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
  .total{font-weight:700;font-size:15px;color:#0078a8;border-top:2px solid #0078a8;margin-top:8px;padding-top:8px}
  .locked{display:inline-block;background:#dcfce7;color:#166534;padding:2px 10px;border-radius:20px;font-size:12px}
</style>
</head><body>
<h1>Closing Report — ${row.doctor_name}</h1>
<p style="color:#666;font-size:13px">${monthName} ${year} · ${typeLabel} (${pct}%)</p>
${closing?.is_confirmed ? '<span class="locked">✓ Confirmed</span>' : ''}

<h2>Transactions</h2>
<table>
  <tr><th>Date</th><th>Patient</th><th>Method</th><th class="right">Amount</th><th class="right">Lab Fees</th></tr>
  ${txs.map((tx) => `<tr>
    <td>${new Date(tx.created_at).toLocaleDateString('en-GB')}</td>
    <td>${tx.patient_name || '—'}</td>
    <td>${tx.payment_method || '—'}</td>
    <td class="right">EGP ${fmt(tx.final_amount)}</td>
    <td class="right">${tx.has_lab_fees ? 'EGP ' + fmt(tx.lab_fees_amount) : '—'}</td>
  </tr>`).join('')}
</table>

<div class="summary">
  <div class="row"><span>Cases</span><span>${row.case_count}</span></div>
  <div class="row"><span>Total Revenue</span><span>EGP ${fmt(row.total_revenue)}</span></div>
  <div class="row"><span>Lab Fees Deducted</span><span>EGP ${fmt(row.total_lab_fees)}</span></div>
  <div class="row"><span>Net Revenue</span><span>EGP ${fmt(row.total_revenue - row.total_lab_fees)}</span></div>
  <div class="row"><span>Doctor Share (${pct}%)</span><span>EGP ${fmt(row.doctor_gross_earnings)}</span></div>
  <div class="row total"><span>Amount to Pay</span><span>EGP ${fmt(parseFloat(state.amountToPay) || row.doctor_gross_earnings)}</span></div>
  ${state.comment ? `<p style="font-size:12px;color:#666;margin-top:8px">Note: ${state.comment}</p>` : ''}
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e) { /* ignore print errors */ }
    finally { setPrintingId(null); }
  };

  const months = lang === 'ar'
    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    : MONTH_NAMES;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('Extern / Custom Closing')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('Monthly closing for extern and custom doctors')}</p>
      </div>

      {/* Month / Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">{t('Month')}</Label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
          >
            {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('Year')}</Label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
          >
            {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="self-end">
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader className="w-4 h-4 me-2 animate-spin" /> : null}
            {loading ? t('Loading...') : t('Load')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Doctor cards */}
      {!loading && summary.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">{t('No extern or custom doctors found for this month.')}</p>
      )}

      {summary.map((row) => {
        const state   = cardStates[row.doctor_id];
        const closing = closings.find((c) => c.doctor_id === row.doctor_id);
        const locked  = closing?.is_confirmed ?? false;
        const pct     = row.doctor_type === 'custom' ? (row.custom_percentage ?? 40) : 40;
        const typeLabel = row.doctor_type === 'custom' ? (row.custom_label || t('Custom')) : `${t('Extern')} (${pct}%)`;
        if (!state) return null;

        // Payment history for this doctor (all confirmed closings, most recent first)
        const history = closingHistory.filter((h) => h.doctor_id === row.doctor_id);

        // When locked, show frozen numbers saved at confirmation time
        const displayCases    = locked && closing ? (closing.case_count ?? row.case_count) : row.case_count;
        const displayRevenue  = locked && closing ? closing.total_revenue        : row.total_revenue;
        const displayLabFees  = locked && closing ? closing.total_lab_fees       : row.total_lab_fees;
        const displayEarnings = locked && closing ? closing.doctor_gross_earnings : row.doctor_gross_earnings;

        // New transactions added after this closing was confirmed
        const pendingCases   = locked && closing ? Math.max(0, row.case_count - (closing.case_count ?? row.case_count)) : 0;
        const pendingRevenue = locked && closing ? Math.max(0, row.total_revenue - closing.total_revenue) : 0;

        return (
          <Card key={row.doctor_id} className={locked ? 'border-green-200 bg-green-50/30' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">{row.doctor_name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{typeLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  {locked && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      <CheckCircle className="w-3 h-3 me-1" /> {t('Confirmed')}
                    </Badge>
                  )}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handlePrint(row)}
                    disabled={printingId === row.doctor_id}
                  >
                    {printingId === row.doctor_id
                      ? <Loader className="w-3.5 h-3.5 animate-spin" />
                      : <Printer className="w-3.5 h-3.5 me-1" />}
                    {t('Print / PDF')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats — frozen at confirmation time when locked */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t('Cases')}</p>
                  <p className="font-semibold">{displayCases}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('Total Revenue')}</p>
                  <p className="font-semibold">{formatCurrency(displayRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('Lab Fees')}</p>
                  <p className="font-semibold">{formatCurrency(displayLabFees)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('Gross Earnings')}</p>
                  <p className="font-semibold text-primary">{formatCurrency(displayEarnings)}</p>
                </div>
              </div>

              {/* New cases added after this closing was confirmed */}
              {pendingCases > 0 && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-sm font-semibold text-amber-800">
                    {pendingCases} {t('new case(s) since this closing')}
                  </p>
                  <p className="text-xs text-amber-700">
                    {t('Revenue')}: {formatCurrency(pendingRevenue)} — {t('Reopen to include in a new closing')}
                  </p>
                </div>
              )}

              {state.error && (
                <p className="text-sm text-red-600">{state.error}</p>
              )}

              {/* Amount to pay + comment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('Amount to Pay (EGP)')}</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={state.amountToPay}
                    onChange={(e) => updateState(row.doctor_id, { amountToPay: e.target.value })}
                    disabled={locked}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('Comment (optional)')}</Label>
                  <Input
                    placeholder={t('Admin note...')}
                    value={state.comment}
                    onChange={(e) => updateState(row.doctor_id, { comment: e.target.value })}
                    disabled={locked}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Payment timeline */}
              {history.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> {t('Payment History')}
                  </p>
                  <div className="space-y-1.5">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-24 shrink-0">
                          {h.confirmed_at ? formatDate(h.confirmed_at) : `${MONTH_NAMES[h.month - 1]} ${h.year}`}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span>{h.case_count ?? '?'} {t('cases')}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold text-green-700">{formatCurrency(h.amount_to_pay ?? 0)}</span>
                        {h.comment && (
                          <span className="text-muted-foreground truncate max-w-[120px]" title={h.comment}>
                            — {h.comment}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action button */}
              {locked ? (
                <Button
                  variant="outline" size="sm"
                  onClick={() => handleReopen(row)}
                  disabled={state.saving}
                >
                  {state.saving ? <Loader className="w-4 h-4 me-2 animate-spin" /> : <Unlock className="w-4 h-4 me-2" />}
                  {t('Reopen')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleConfirm(row)}
                  disabled={state.saving}
                >
                  {state.saving ? <Loader className="w-4 h-4 me-2 animate-spin" /> : <Lock className="w-4 h-4 me-2" />}
                  {t('Confirm & Lock')}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
