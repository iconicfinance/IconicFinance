import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader, CheckCircle, Lock, Unlock, Printer, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMonthlySummary,
  getClosingsForMonth,
  saveClosing,
  confirmClosing,
  reopenClosing,
  MonthlySummaryRow,
  MonthlyClosing,
} from '@/services/monthlyClosings';
import {
  getSalariesForMonth,
  createSalary,
  deleteSalary,
  Salary,
} from '@/services/salaries';
import { getTransactionsByDoctor } from '@/services/transactions';
import { getLabFeesForMonth } from '@/services/transactionLabFees';
import {
  formatCurrency,
  formatDate,
  MONTH_NAMES,
} from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DoctorCardState {
  amountToPay: string;
  comment: string;
  saving: boolean;
  error: string;
}

export default function AdminMonthlyClosure() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, DoctorCardState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Lab fees per lab
  const [labTotals, setLabTotals] = useState<{ lab_id: string; lab_name: string; total: number }[]>([]);

  // Salary state
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [newSalaryName, setNewSalaryName] = useState('');
  const [newSalaryAmount, setNewSalaryAmount] = useState('');
  const [newSalaryNotes, setNewSalaryNotes] = useState('');
  const [addingSalary, setAddingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, closingData, salaryData, labData] = await Promise.all([
        getMonthlySummary(year, month),
        getClosingsForMonth(year, month),
        getSalariesForMonth(year, month),
        getLabFeesForMonth(year, month),
      ]);
      setSummary(sumData);
      setClosings(closingData);
      setSalaries(salaryData);
      setLabTotals(labData);

      const states: Record<string, DoctorCardState> = {};
      sumData.forEach((row) => {
        const existing = closingData.find((c) => c.doctor_id === row.doctor_id);
        states[row.doctor_id] = {
          amountToPay: existing?.amount_to_pay?.toString() ?? row.doctor_gross_earnings.toString(),
          comment: existing?.comment ?? '',
          saving: false,
          error: '',
        };
      });
      setCardStates(states);
    } catch (err: any) {
      setError(err.message || 'Failed to load monthly summary');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const getClosing = (doctorId: string) => closings.find((c) => c.doctor_id === doctorId) || null;

  const updateCard = (doctorId: string, patch: Partial<DoctorCardState>) => {
    setCardStates((prev) => ({
      ...prev,
      [doctorId]: { ...prev[doctorId], ...patch },
    }));
  };

  const handleConfirm = async (row: MonthlySummaryRow) => {
    if (!user) return;
    const state = cardStates[row.doctor_id];
    updateCard(row.doctor_id, { saving: true, error: '' });

    try {
      const saved = await saveClosing({
        month,
        year,
        doctor_id: row.doctor_id,
        total_revenue: Number(row.total_revenue),
        total_lab_fees: Number(row.total_lab_fees),
        doctor_gross_earnings: Number(row.doctor_gross_earnings),
        clinic_remaining_share: row.doctor_type === 'primary' ? Number(row.primary_doctor_share) : null,
        amount_to_pay: parseFloat(state.amountToPay) || 0,
        comment: state.comment.trim() || null,
        is_confirmed: false,
      });
      await confirmClosing(saved.id, user.id);
      await load();
    } catch (err: any) {
      updateCard(row.doctor_id, { error: err.message || 'Failed to confirm closing' });
    } finally {
      updateCard(row.doctor_id, { saving: false });
    }
  };

  const handleReopen = async (closing: MonthlyClosing) => {
    try {
      await reopenClosing(closing.id);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen closing');
    }
  };

  const handleAddSalary = async () => {
    if (!user) return;
    if (!newSalaryName.trim()) { setSalaryError('Person name is required.'); return; }
    const amount = parseFloat(newSalaryAmount);
    if (!newSalaryAmount || amount <= 0) { setSalaryError('Enter a valid amount.'); return; }
    setSalaryError('');
    setAddingSalary(true);
    try {
      const created = await createSalary({
        month, year,
        person_name: newSalaryName.trim(),
        amount,
        notes: newSalaryNotes.trim() || null,
        created_by: user.id,
      });
      setSalaries((prev) => [...prev, created]);
      setNewSalaryName('');
      setNewSalaryAmount('');
      setNewSalaryNotes('');
      // Reload summary so clinic_remaining reflects the new salary
      await load();
    } catch (err: any) {
      setSalaryError(err.message || 'Failed to add salary.');
    } finally {
      setAddingSalary(false);
    }
  };

  const handleDeleteSalary = async (id: string) => {
    try {
      await deleteSalary(id);
      setSalaries((prev) => prev.filter((s) => s.id !== id));
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete salary.');
    }
  };

  const handlePrint = async (row: MonthlySummaryRow) => {
    const closing = getClosing(row.doctor_id);
    setPrintingId(row.doctor_id);
    try {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 1);
      const txs = await getTransactionsByDoctor(row.doctor_id, from, to);

      const html = buildPrintHTML({ row, closing, transactions: txs, salaries, month, year });

      // Open in a new window — works on all platforms including iOS PWA
      // (iOS PWA opens in Safari, where the user can print/save to PDF via the share sheet)
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        setError('Pop-up blocked. Please allow pop-ups for this site to export PDFs.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load print data');
    } finally {
      setPrintingId(null);
    }
  };

  const clinicRow = summary[0];

  const doctorTypeLabel = (row: MonthlySummaryRow) => {
    if (row.doctor_type === 'primary') return t('Primary');
    if (row.doctor_type === 'extern') return 'Extern (40%)';
    return row.custom_label ? `Custom — ${row.custom_label}` : `Custom (${row.custom_percentage}%)`;
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('Monthly Closing')}</h1>
          <p className="text-muted-foreground text-sm mt-1">End-of-month financial settlement</p>
        </div>

        {/* Month / Year Picker */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
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
                  {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : t('Load')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">{t('Loading...')}</span>
          </div>
        )}

        {!loading && summary.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No doctor activity found for {MONTH_NAMES[month - 1]} {year}.
          </div>
        )}

        {/* Clinic-wide Summary */}
        {!loading && clinicRow && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t('Clinic Summary')} — {MONTH_NAMES[month - 1]} {year}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-green-700">{t('Total Revenue')}</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-green-800">{formatCurrency(clinicRow.clinic_total_revenue)}</p></CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-red-700">{t('Total Expenses')}</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-red-800">{formatCurrency(clinicRow.clinic_total_expenses)}</p></CardContent>
              </Card>
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-orange-700">{t('Total Salaries')}</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-orange-800">{formatCurrency(clinicRow.clinic_total_salaries)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{t('Extern / Custom Cut')}</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold">{formatCurrency(clinicRow.clinic_extern_custom_cut)}</p></CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-primary">{t('Clinic Remaining')}</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-primary">{formatCurrency(clinicRow.clinic_remaining)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    {t('Primary Share')} ({clinicRow.primary_doctor_count} doctors)
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-lg font-bold">{formatCurrency(clinicRow.primary_doctor_share)}</p></CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Lab Fees by Lab ── */}
        {!loading && labTotals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {t('Lab Fees')} — {MONTH_NAMES[month - 1]} {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {labTotals.map((lt) => (
                  <div key={lt.lab_id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium">{lt.lab_name}</span>
                    <span className="font-semibold text-sm">{formatCurrency(lt.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-bold">{formatCurrency(labTotals.reduce((s, l) => s + l.total, 0))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Salary Management (admin only) ── */}
        {!loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {t('Monthly Salaries')} — {MONTH_NAMES[month - 1]} {year}
                <Badge variant="secondary" className="ml-auto">
                  {formatCurrency(salaries.reduce((s, x) => s + Number(x.amount), 0))} total
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing salaries */}
              {salaries.length > 0 && (
                <div className="space-y-2">
                  {salaries.map((sal) => (
                    <div key={sal.id} className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50 border-orange-200">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{sal.person_name}</p>
                        {sal.notes && <p className="text-xs text-muted-foreground truncate">{sal.notes}</p>}
                      </div>
                      <span className="font-semibold text-orange-700 whitespace-nowrap">{formatCurrency(sal.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSalary(sal.id)}
                        className="p-1.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors flex-shrink-0"
                        title="Delete salary"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new salary */}
              {salaryError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {salaryError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Person Name *</Label>
                  <Input
                    placeholder="e.g. Reception staff"
                    value={newSalaryName}
                    onChange={(e) => setNewSalaryName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount (EGP) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newSalaryAmount}
                    onChange={(e) => setNewSalaryAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('Notes (optional)')}</Label>
                  <Input
                    placeholder="Any notes..."
                    value={newSalaryNotes}
                    onChange={(e) => setNewSalaryNotes(e.target.value)}
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleAddSalary} disabled={addingSalary}>
                {addingSalary ? <Loader className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                {addingSalary ? 'Adding...' : t('Add Salary')}
              </Button>
              {salaries.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('No salaries recorded for this month yet.')}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Per-Doctor Cards */}
        {!loading && summary.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t('Per-Doctor Closings')}</h2>
            {summary.map((row) => {
              const closing = getClosing(row.doctor_id);
              const state = cardStates[row.doctor_id] || { amountToPay: '', comment: '', saving: false, error: '' };
              const isConfirmed = closing?.is_confirmed === true;

              return (
                <Card
                  key={row.doctor_id}
                  className={isConfirmed ? 'border-green-300 bg-green-50' : ''}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base">{row.doctor_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">{doctorTypeLabel(row)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isConfirmed && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Confirmed {closing?.confirmed_at ? formatDate(closing.confirmed_at) : ''}
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint(row)}
                          disabled={printingId === row.doctor_id}
                        >
                          {printingId === row.doctor_id
                            ? <Loader className="w-4 h-4 mr-1 animate-spin" />
                            : <Printer className="w-4 h-4 mr-1" />}
                          {printingId === row.doctor_id ? t('Loading...') : t('Print / PDF')}
                        </Button>
                        {isConfirmed && closing && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReopen(closing)}
                          >
                            <Unlock className="w-4 h-4 mr-1" /> {t('Reopen')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Cases')}</p>
                        <p className="font-semibold">{row.case_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Total Revenue')}</p>
                        <p className="font-semibold">{formatCurrency(row.total_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Lab Fees')}</p>
                        <p className="font-semibold">{formatCurrency(row.total_lab_fees)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('Gross Earnings')}</p>
                        <p className="font-semibold text-primary">{formatCurrency(row.doctor_gross_earnings)}</p>
                      </div>
                    </div>

                    {state.error && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-600 mb-3">
                        {state.error}
                      </div>
                    )}

                    {/* Editable fields — locked when confirmed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('Amount to Pay (EGP)')}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={isConfirmed ? (closing?.amount_to_pay?.toString() ?? '') : state.amountToPay}
                          onChange={(e) => !isConfirmed && updateCard(row.doctor_id, { amountToPay: e.target.value })}
                          disabled={isConfirmed}
                          className={isConfirmed ? 'bg-muted cursor-not-allowed' : ''}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('Comment (optional)')}</Label>
                        <Input
                          placeholder="Admin note..."
                          value={isConfirmed ? (closing?.comment ?? '') : state.comment}
                          onChange={(e) => !isConfirmed && updateCard(row.doctor_id, { comment: e.target.value })}
                          disabled={isConfirmed}
                          className={isConfirmed ? 'bg-muted cursor-not-allowed' : ''}
                        />
                      </div>
                    </div>

                    {!isConfirmed && (
                      <div className="mt-4">
                        <Button
                          onClick={() => handleConfirm(row)}
                          disabled={state.saving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {state.saving ? (
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4 mr-2" />
                          )}
                          {state.saving ? 'Confirming...' : t('Confirm & Lock')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Standalone HTML generator ────────────────────────────────────────────────
// Returns a complete self-contained HTML document opened in a new window.
// Works on desktop, Android, and iOS (PWA opens it in Safari where print/share works).

interface PrintPayload {
  row: MonthlySummaryRow;
  closing: MonthlyClosing | null;
  transactions: any[];
  salaries: Salary[];
  month: number;
  year: number;
}

function buildPrintHTML({ row, closing, transactions, salaries, month, year }: PrintPayload): string {
  const monthName = MONTH_NAMES[month - 1];

  const fmt = (n: number | null | undefined) =>
    n == null ? '—' : `EGP ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const methodLabel: Record<string, string> = { cash: 'Cash', vodafone_cash: 'Vodafone Cash', instapay: 'Instapay' };

  const typeLabel =
    row.doctor_type === 'primary' ? 'Primary' :
    row.doctor_type === 'extern' ? 'Extern (40%)' :
    row.custom_label ? `Custom — ${row.custom_label}` : `Custom (${row.custom_percentage}%)`;

  const amountToPay = fmt(closing?.amount_to_pay ?? row.doctor_gross_earnings);

  const txRows = transactions.map((tx: any) => `
    <tr>
      <td>${fmtDate(tx.created_at)}</td>
      <td>${tx.patient_name || '—'}</td>
      <td>${methodLabel[tx.payment_method] || '—'}</td>
      <td class="right">${fmt(tx.base_amount)}</td>
      <td class="right">${fmt(tx.final_amount)}</td>
      <td class="right">${tx.lab_fees_pending ? '⚠ Pending' : tx.has_lab_fees ? fmt(tx.lab_fees_amount) : '—'}</td>
      <td class="right">${fmt(tx.doctor_earnings)}</td>
    </tr>`).join('');

  const confirmedLine = closing?.is_confirmed && closing.confirmed_at
    ? `<p><strong>Confirmed:</strong> ${new Date(closing.confirmed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>`
    : '';

  const commentLine = closing?.comment
    ? `<tr><td class="label">Admin Comment</td><td class="value" style="font-style:italic">${closing.comment}</td></tr>`
    : '';

  const totalSalaries = salaries.reduce((s, x) => s + Number(x.amount), 0);

  // Salaries section — shown for primary doctors only (they absorb the salary deduction)
  const salariesSection = (row.doctor_type === 'primary' && salaries.length > 0) ? `
  <div style="margin-bottom:28px">
    <h2 style="font-size:15px;font-weight:600;margin-bottom:10px;color:#92400e">Monthly Salary Deductions</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#fef3c7">
          <th style="padding:7px 10px;text-align:left;border:1px solid #fcd34d;font-weight:600">Employee</th>
          <th style="padding:7px 10px;text-align:left;border:1px solid #fcd34d;font-weight:600">Notes</th>
          <th style="padding:7px 10px;text-align:right;border:1px solid #fcd34d;font-weight:600">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${salaries.map((s) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #fde68a">${s.person_name}</td>
          <td style="padding:6px 10px;border:1px solid #fde68a;color:#555">${s.notes || '—'}</td>
          <td style="padding:6px 10px;border:1px solid #fde68a;text-align:right">${fmt(s.amount)}</td>
        </tr>`).join('')}
        <tr style="background:#fef3c7;font-weight:600">
          <td colspan="2" style="padding:7px 10px;border:1px solid #fcd34d">Total Salaries Deducted</td>
          <td style="padding:7px 10px;border:1px solid #fcd34d;text-align:right;color:#92400e">${fmt(totalSalaries)}</td>
        </tr>
      </tbody>
    </table>
  </div>` : '';

  const logoUrl = `${window.location.origin}/logos/iconic-finance.png`;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Iconic Finance — ${row.doctor_name} — ${monthName} ${year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 32px; max-width: 960px; margin: 0 auto; font-size: 13px; }
    h1 { font-size: 26px; font-weight: 700; color: #0078a8; }
    h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
    .header { border-bottom: 2px solid #0078a8; padding-bottom: 14px; margin-bottom: 22px; }
    .header p { color: #555; margin-top: 4px; font-size: 13px; }
    .meta { margin-bottom: 22px; line-height: 1.8; }
    .meta p { font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 12px; }
    thead tr { background: #f3f4f6; }
    th { padding: 8px 10px; text-align: left; font-weight: 600; border: 1px solid #d1d5db; color: #374151; }
    td { padding: 7px 10px; border: 1px solid #e5e7eb; color: #111; }
    .right { text-align: right; }
    .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; }
    .summary-box h2 { margin-bottom: 10px; font-size: 15px; }
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-table .label { color: #555; padding: 5px 0; width: 60%; }
    .summary-table .value { text-align: right; font-weight: 600; padding: 5px 0; }
    .footer { margin-top: 32px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header" style="display:flex;align-items:center;gap:16px">
    <img src="${logoUrl}" alt="Iconic Finance" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">
    <div>
      <h1>Iconic Finance</h1>
      <p>Monthly Closing Report — ${monthName} ${year}</p>
    </div>
  </div>

  <div class="meta">
    <p><strong>Doctor:</strong> ${row.doctor_name}</p>
    <p><strong>Type:</strong> ${typeLabel}</p>
    <p><strong>Period:</strong> ${monthName} ${year}</p>
    ${confirmedLine}
  </div>

  <h2>Transaction Details</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Patient</th>
        <th>Method</th>
        <th class="right">Base Amount</th>
        <th class="right">Final Amount</th>
        <th class="right">Lab Fees</th>
        <th class="right">Dr. Earnings</th>
      </tr>
    </thead>
    <tbody>
      ${txRows || '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:16px">No transactions this month</td></tr>'}
    </tbody>
  </table>

  ${salariesSection}

  <div class="summary-box">
    <h2>Summary</h2>
    <table class="summary-table">
      <tr><td class="label">Total Cases</td><td class="value">${row.case_count}</td></tr>
      <tr><td class="label">Total Revenue</td><td class="value">${fmt(row.total_revenue)}</td></tr>
      <tr><td class="label">Total Lab Fees Deducted</td><td class="value">${fmt(row.total_lab_fees)}</td></tr>
      ${row.doctor_type === 'primary' && totalSalaries > 0 ? `<tr><td class="label" style="color:#92400e">Total Salaries Deducted</td><td class="value" style="color:#92400e">${fmt(totalSalaries)}</td></tr>` : ''}
      <tr><td class="label">Gross Earnings</td><td class="value">${fmt(row.doctor_gross_earnings)}</td></tr>
      <tr><td class="label" style="font-weight:600">Amount to Pay</td><td class="value" style="font-size:15px;color:#0078a8">${amountToPay}</td></tr>
      ${commentLine}
    </table>
  </div>

  <div class="footer">Generated by Iconic Finance — ${today}</div>

  <script>
    // Auto-trigger print on desktop and Android.
    // On iOS (PWA or Safari), the user can use the Share button → Print / Save to Files.
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}
