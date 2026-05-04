import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, Loader, CheckCircle, Lock, Unlock, Printer } from 'lucide-react';
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
import { getTransactionsByDoctor } from '@/services/transactions';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPaymentMethod,
  formatMonth,
  MONTH_NAMES,
} from '@/lib/utils';

interface DoctorCardState {
  amountToPay: string;
  comment: string;
  saving: boolean;
  error: string;
}

interface PrintData {
  row: MonthlySummaryRow;
  closing: MonthlyClosing | null;
  transactions: any[];
  month: number;
  year: number;
}

export default function AdminMonthlyClosure() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [cardStates, setCardStates] = useState<Record<string, DoctorCardState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const printTimeout = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sumData, closingData] = await Promise.all([
        getMonthlySummary(year, month),
        getClosingsForMonth(year, month),
      ]);
      setSummary(sumData);
      setClosings(closingData);

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

  const handlePrint = async (row: MonthlySummaryRow) => {
    const closing = getClosing(row.doctor_id);
    try {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 1);
      const txs = await getTransactionsByDoctor(row.doctor_id, from, to);
      setPrintData({ row, closing, transactions: txs, month, year });
      clearTimeout(printTimeout.current);
      printTimeout.current = setTimeout(() => {
        window.print();
        setPrintData(null);
      }, 300);
    } catch (err: any) {
      setError(err.message || 'Failed to load print data');
    }
  };

  const clinicRow = summary[0];

  const doctorTypeLabel = (row: MonthlySummaryRow) => {
    if (row.doctor_type === 'primary') return 'Primary';
    if (row.doctor_type === 'extern') return 'Extern (40%)';
    return row.custom_label ? `Custom — ${row.custom_label}` : `Custom (${row.custom_percentage}%)`;
  };

  return (
    <>
      {/* Print View — hidden on screen, shown only when printing */}
      {printData && (
        <div className="print-only" style={{ display: 'none' }}>
          <PrintView data={printData} />
        </div>
      )}

      <div className="space-y-6 no-print">
        <div>
          <h1 className="text-2xl font-bold">Monthly Closing</h1>
          <p className="text-muted-foreground text-sm mt-1">End-of-month financial settlement</p>
        </div>

        {/* Month / Year Picker */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Month</Label>
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
                <Label className="text-xs">Year</Label>
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
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Load'}
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
            <span className="ml-2 text-muted-foreground">Loading summary...</span>
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
            <h2 className="text-lg font-semibold">Clinic Summary — {MONTH_NAMES[month - 1]} {year}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-green-700">Total Revenue</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-green-800">{formatCurrency(clinicRow.clinic_total_revenue)}</p></CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-red-700">Total Expenses</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-red-800">{formatCurrency(clinicRow.clinic_total_expenses)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Extern / Custom Cut</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold">{formatCurrency(clinicRow.clinic_extern_custom_cut)}</p></CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-1"><CardTitle className="text-xs text-primary">Clinic Remaining</CardTitle></CardHeader>
                <CardContent><p className="text-lg font-bold text-primary">{formatCurrency(clinicRow.clinic_remaining)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground">
                    Primary Share ({clinicRow.primary_doctor_count} doctors)
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-lg font-bold">{formatCurrency(clinicRow.primary_doctor_share)}</p></CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Per-Doctor Cards */}
        {!loading && summary.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Per-Doctor Closings</h2>
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
                        >
                          <Printer className="w-4 h-4 mr-1" /> Print / PDF
                        </Button>
                        {isConfirmed && closing && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReopen(closing)}
                          >
                            <Unlock className="w-4 h-4 mr-1" /> Re-open
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Cases</p>
                        <p className="font-semibold">{row.case_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                        <p className="font-semibold">{formatCurrency(row.total_revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lab Fees</p>
                        <p className="font-semibold">{formatCurrency(row.total_lab_fees)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gross Earnings</p>
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
                        <Label className="text-xs">Amount to Pay (EGP)</Label>
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
                        <Label className="text-xs">Comment (optional)</Label>
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
                          {state.saving ? 'Confirming...' : 'Confirm & Lock'}
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

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
    </>
  );
}

function PrintView({ data }: { data: PrintData }) {
  const { row, closing, transactions, month, year } = data;

  const doctorTypeLabel = () => {
    if (row.doctor_type === 'primary') return 'Primary';
    if (row.doctor_type === 'extern') return 'Extern (40%)';
    return row.custom_label ? `Custom — ${row.custom_label}` : `Custom (${row.custom_percentage}%)`;
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '40px', maxWidth: '900px', margin: '0 auto', color: '#111' }}>
      <div style={{ borderBottom: '2px solid #333', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Iconic Finance</h1>
        <p style={{ margin: '4px 0 0', color: '#555', fontSize: '14px' }}>Monthly Closing Report — {MONTH_NAMES[month - 1]} {year}</p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ margin: '4px 0', fontSize: '15px' }}><strong>Doctor:</strong> {row.doctor_name}</p>
        <p style={{ margin: '4px 0', fontSize: '15px' }}><strong>Type:</strong> {doctorTypeLabel()}</p>
        <p style={{ margin: '4px 0', fontSize: '15px' }}><strong>Period:</strong> {MONTH_NAMES[month - 1]} {year}</p>
        {closing?.is_confirmed && (
          <p style={{ margin: '4px 0', fontSize: '15px' }}>
            <strong>Confirmed:</strong> {closing.confirmed_at ? formatDateTime(closing.confirmed_at) : ''}
          </p>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            {['Date', 'Patient', 'Method', 'Base Amount', 'Final Amount', 'Lab Fees', 'Dr. Earnings'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #d1d5db', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx: any) => (
            <tr key={tx.id}>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb' }}>{formatDate(tx.created_at)}</td>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb' }}>{tx.patient_name || '—'}</td>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb' }}>{formatPaymentMethod(tx.payment_method)}</td>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatCurrency(tx.base_amount)}</td>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatCurrency(tx.final_amount)}</td>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                {tx.lab_fees_pending ? 'Pending' : tx.has_lab_fees ? formatCurrency(tx.lab_fees_amount) : '—'}
              </td>
              <td style={{ padding: '7px 12px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatCurrency(tx.doctor_earnings)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Summary</h3>
        <table style={{ width: '100%', fontSize: '14px' }}>
          <tbody>
            {[
              ['Total Cases', row.case_count.toString()],
              ['Total Revenue', formatCurrency(row.total_revenue)],
              ['Total Lab Fees Deducted', formatCurrency(row.total_lab_fees)],
              ['Gross Earnings', formatCurrency(row.doctor_gross_earnings)],
              ['Amount to Pay', formatCurrency(closing?.amount_to_pay ?? row.doctor_gross_earnings)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '4px 0', color: '#555' }}>{label}</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>{value}</td>
              </tr>
            ))}
            {closing?.comment && (
              <tr>
                <td style={{ padding: '4px 0', color: '#555' }}>Admin Comment</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontStyle: 'italic' }}>{closing.comment}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '32px', color: '#9ca3af', fontSize: '11px', textAlign: 'center' }}>
        Generated by Iconic Finance — {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}
