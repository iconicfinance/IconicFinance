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
  saveClosing, confirmClosing,
  type MonthlySummaryRow, type MonthlyClosing,
} from '@/services/monthlyClosings';
import { getTransactionsByDoctor } from '@/services/transactions';
import { getDoctorTypeLabel, getDoctorDisplayName } from '@/services/doctors';
import { formatCurrency, formatDate, MONTH_NAMES } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DoctorState {
  amountToPay: string;
  comment: string;
  saving: boolean;
  error: string;
}

// Returns the most recent closing for a doctor from a list
const latestClosing = (list: MonthlyClosing[], doctorId: string): MonthlyClosing | undefined =>
  [...list]
    .filter((c) => c.doctor_id === doctorId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

export default function AssistantClosing() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [summary, setSummary]               = useState<MonthlySummaryRow[]>([]);
  const [closings, setClosings]             = useState<MonthlyClosing[]>([]);
  const [closingHistory, setClosingHistory] = useState<MonthlyClosing[]>([]);
  const [cardStates, setCardStates]         = useState<Record<string, DoctorState>>({});
  // Doctors whose closing was manually reopened (UI-only state, no DB change)
  const [reopenedDoctors, setReopenedDoctors] = useState<Set<string>>(new Set());
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReopenedDoctors(new Set());
    try {
      const [sumData, closingData, historyData] = await Promise.all([
        getMonthlySummary(year, month),
        getClosingsForMonth(year, month),
        getAllConfirmedClosings(),
      ]);
      const filtered = sumData.filter((r) => r.doctor_type === 'extern' || r.doctor_type === 'custom');
      setSummary(filtered);
      setClosings(closingData);
      setClosingHistory(historyData.filter((h) => filtered.some((r) => r.doctor_id === h.doctor_id)));

      const states: Record<string, DoctorState> = {};
      filtered.forEach((row) => {
        const recent = latestClosing(closingData, row.doctor_id);
        // Default amount = delta since last confirmed closing (0 if no previous)
        const delta = recent
          ? Math.max(0, row.doctor_gross_earnings - (recent.doctor_gross_earnings ?? 0))
          : row.doctor_gross_earnings;
        states[row.doctor_id] = {
          amountToPay: recent ? delta.toString() : row.doctor_gross_earnings.toString(),
          comment: '',
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
      const todayStr = new Date().toISOString().split('T')[0];
      // Always INSERT a new record — each payment is its own history entry
      const saved = await saveClosing({
        month, year,
        doctor_id: row.doctor_id,
        case_count: row.case_count,
        closing_date: todayStr,
        total_revenue: row.total_revenue,
        total_lab_fees: row.total_lab_fees,
        doctor_gross_earnings: row.doctor_gross_earnings,
        clinic_remaining_share: null,
        amount_to_pay: parseFloat(state.amountToPay) || 0,
        comment: state.comment || null,
        is_confirmed: false,
      });
      const confirmed = await confirmClosing(saved.id, user.id);

      // Update state immediately — no reload needed
      setClosings((prev) => [...prev, confirmed]);
      setClosingHistory((prev) => [confirmed, ...prev]);
      setReopenedDoctors((prev) => { const next = new Set(prev); next.delete(row.doctor_id); return next; });

      // Reset amount for next cycle (delta will now be 0 since we just closed everything)
      updateState(row.doctor_id, { comment: '' });
    } catch (e: any) {
      updateState(row.doctor_id, { error: e.message || 'Failed to save' });
    } finally {
      updateState(row.doctor_id, { saving: false });
    }
  };

  const handleReopen = (row: MonthlySummaryRow) => {
    // UI-only — does NOT touch the DB. Next confirm will INSERT a new record.
    const recent = latestClosing(closings, row.doctor_id);
    const delta = recent
      ? Math.max(0, row.doctor_gross_earnings - (recent.doctor_gross_earnings ?? 0))
      : row.doctor_gross_earnings;
    setReopenedDoctors((prev) => new Set([...prev, row.doctor_id]));
    updateState(row.doctor_id, { amountToPay: delta > 0 ? delta.toString() : '0', error: '' });
  };

  const handlePrint = async (row: MonthlySummaryRow) => {
    setPrintingId(row.doctor_id);
    try {
      const from = new Date(year, month - 1, 1);
      const to   = new Date(year, month, 1);
      const txs  = await getTransactionsByDoctor(row.doctor_id, from, to);
      const state   = cardStates[row.doctor_id];
      const closing = latestClosing(closings, row.doctor_id);
      const fmt = (n: number | null | undefined) =>
        n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const monthName = MONTH_NAMES[month - 1];
      const typeLabel = row.doctor_type === 'custom'
        ? getDoctorTypeLabel({ type: row.doctor_type, custom_label: row.custom_label, custom_percentage: row.custom_percentage })
        : 'Extern';
      const pct = row.doctor_type === 'custom' ? (row.custom_percentage ?? 40) : 40;
      const doctorDisplayName = getDoctorDisplayName({ name: row.doctor_name, type: row.doctor_type, custom_label: row.custom_label });

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Closing — ${doctorDisplayName} — ${monthName} ${year}</title>
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
<h1>Closing Report — ${doctorDisplayName}</h1>
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
  <div class="row total"><span>Amount to Pay (this session)</span><span>EGP ${fmt(parseFloat(state.amountToPay) || 0)}</span></div>
  ${state.comment ? `<p style="font-size:12px;color:#666;margin-top:8px">Note: ${state.comment}</p>` : ''}
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e) { /* ignore */ }
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

      {!loading && summary.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">{t('No extern or custom doctors found for this month.')}</p>
      )}

      {summary.map((row) => {
        const state          = cardStates[row.doctor_id];
        const recent         = latestClosing(closings, row.doctor_id);
        const wasReopened    = reopenedDoctors.has(row.doctor_id);
        const locked         = (recent?.is_confirmed ?? false) && !wasReopened;
        const pct            = row.doctor_type === 'custom' ? (row.custom_percentage ?? 40) : 40;
        const typeLabel      = row.doctor_type === 'custom'
          ? getDoctorTypeLabel({ type: row.doctor_type, custom_label: row.custom_label, custom_percentage: row.custom_percentage })
          : `${t('Extern')} (${pct}%)`;
        const history        = closingHistory.filter((h) => h.doctor_id === row.doctor_id);
        if (!state) return null;

        // When locked show the frozen stats from the most recent confirmed record
        const displayCases    = locked && recent ? (recent.case_count ?? row.case_count) : row.case_count;
        const displayRevenue  = locked && recent ? recent.total_revenue         : row.total_revenue;
        const displayLabFees  = locked && recent ? recent.total_lab_fees        : row.total_lab_fees;
        const displayEarnings = locked && recent ? recent.doctor_gross_earnings : row.doctor_gross_earnings;

        // New cases since the most recent confirmed closing
        const pendingCases   = recent ? Math.max(0, row.case_count - (recent.case_count ?? 0)) : 0;
        const pendingRevenue = recent ? Math.max(0, row.total_revenue - recent.total_revenue) : 0;

        return (
          <Card key={row.doctor_id} className={locked ? 'border-green-200 bg-green-50/30' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">{getDoctorDisplayName({ name: row.doctor_name, type: row.doctor_type, custom_label: row.custom_label })}</CardTitle>
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
              {/* Stats */}
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

              {/* New cases since last closing */}
              {locked && pendingCases > 0 && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-sm font-semibold text-amber-800">
                    {pendingCases} {t('new case(s) since this closing')}
                  </p>
                  <p className="text-xs text-amber-700">
                    {t('Revenue')}: {formatCurrency(pendingRevenue)} — {t('Reopen to include in a new closing')}
                  </p>
                </div>
              )}

              {state.error && <p className="text-sm text-red-600">{state.error}</p>}

              {/* Amount to pay + comment */}
              {!locked && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('Amount to Pay (EGP)')}</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={state.amountToPay}
                      onChange={(e) => updateState(row.doctor_id, { amountToPay: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('Comment (optional)')}</Label>
                    <Input
                      placeholder={t('Admin note...')}
                      value={state.comment}
                      onChange={(e) => updateState(row.doctor_id, { comment: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              {/* Payment timeline */}
              {history.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> {t('Payment History')}
                  </p>
                  <div className="space-y-1.5">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-muted-foreground shrink-0">
                          {h.confirmed_at ? formatDate(h.confirmed_at) : `${MONTH_NAMES[h.month - 1]} ${h.year}`}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span>{h.case_count ?? '?'} {t('cases')}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-semibold text-green-700">{formatCurrency(h.amount_to_pay ?? 0)}</span>
                        {h.comment && (
                          <span className="text-muted-foreground italic truncate max-w-[150px]" title={h.comment}>
                            — {h.comment}
                          </span>
                        )}
                      </div>
                    ))}
                    <div className="text-xs font-semibold text-muted-foreground pt-1 border-t">
                      {t('Total paid')}: {formatCurrency(history.reduce((s, h) => s + (h.amount_to_pay ?? 0), 0))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action button */}
              {locked ? (
                <Button variant="outline" size="sm" onClick={() => handleReopen(row)}>
                  <Unlock className="w-4 h-4 me-2" /> {t('Reopen')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleConfirm(row)} disabled={state.saving}>
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
