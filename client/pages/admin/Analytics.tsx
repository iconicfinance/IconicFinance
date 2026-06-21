import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, Loader, TrendingUp, TrendingDown, Wallet, Users, UserPlus,
  AlertTriangle, Activity, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  getAnalyticsSummary, getRevenueTrend, getPatientGrowthTrend,
  type AnalyticsSummary, type MonthBucket, type PatientGrowthBucket,
} from '@/services/analytics';
import { getDoctorTypeLabel } from '@/services/doctors';
import { formatCurrency, formatPaymentMethod } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const COLORS = {
  primary: '#0078a8',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  purple: '#7c3aed',
  teal: '#0d9488',
};
const PIE_COLORS = ['#0078a8', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0d9488', '#db2777', '#65a30d'];

function Kpi({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'green' | 'red' | 'amber';
}) {
  const toneClasses: Record<string, string> = {
    default: 'text-foreground',
    green: 'text-green-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
        <p className={`text-lg sm:text-xl font-bold mt-1 ${toneClasses[tone]}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminAnalytics() {
  const { t } = useLanguage();
  const now = new Date();

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => now.toISOString().split('T')[0]);
  const [rangeLabel, setRangeLabel] = useState('This Month');

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<MonthBucket[]>([]);
  const [patientGrowth, setPatientGrowth] = useState<PatientGrowthBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildRange = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0);
    return { from, to };
  };

  const load = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = buildRange();
      const [s, rt, pg] = await Promise.all([
        getAnalyticsSummary(from, to),
        getRevenueTrend(12),
        getPatientGrowthTrend(12),
      ]);
      setSummary(s);
      setRevenueTrend(rt);
      setPatientGrowth(pg);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const applyPreset = (preset: string, label: string) => {
    const n = new Date();
    let from: Date;
    let to: Date = n;
    if (preset === 'today') from = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    else if (preset === 'this_month') from = new Date(n.getFullYear(), n.getMonth(), 1);
    else if (preset === 'last_month') {
      from = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      to = new Date(n.getFullYear(), n.getMonth(), 0);
    }
    else if (preset === 'last_30') from = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 30);
    else if (preset === 'last_90') from = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 90);
    else if (preset === 'last_6m') from = new Date(n.getFullYear(), n.getMonth() - 6, n.getDate());
    else if (preset === 'this_year') from = new Date(n.getFullYear(), 0, 1);
    else from = new Date(n.getFullYear(), n.getMonth(), 1);
    setFromDate(from.toISOString().split('T')[0]);
    setToDate(to.toISOString().split('T')[0]);
    setRangeLabel(label);
  };

  const presets: [string, string][] = [
    ['today', 'Today'], ['this_month', 'This Month'], ['last_month', 'Last Month'],
    ['last_30', 'Last 30 Days'], ['last_90', 'Last 90 Days'],
    ['last_6m', 'Last 6 Months'], ['this_year', 'This Year'],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Clinic-wide statistics and trends</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {presets.map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={rangeLabel === label ? 'default' : 'outline'}
                onClick={() => applyPreset(key, label)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setRangeLabel('Custom'); }}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setRangeLabel('Custom'); }}
                className="w-40"
              />
            </div>
            <Button size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Load'}
            </Button>
            <Badge variant="secondary" className="h-8 px-3 flex items-center">{rangeLabel}</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : summary && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Kpi label="Total Revenue" value={formatCurrency(summary.totalRevenue)} icon={TrendingUp} tone="green" />
            <Kpi label="Total Expenses" value={formatCurrency(summary.totalExpenses)} icon={TrendingDown} tone="red" />
            <Kpi
              label="Net Income"
              value={formatCurrency(summary.netIncome)}
              icon={Wallet}
              tone={summary.netIncome >= 0 ? 'green' : 'red'}
            />
            <Kpi label="Cases" value={String(summary.caseCount)} sub={`Avg ${formatCurrency(summary.avgTransactionValue)}`} icon={ClipboardList} />
            <Kpi label="Active Patients" value={String(summary.uniquePatients)} icon={Users} />
            <Kpi label="New Patients" value={String(summary.newPatients)} icon={UserPlus} tone="green" />
            <Kpi label="Outstanding Balance" value={formatCurrency(summary.outstandingTotal)} sub={`${summary.outstandingPatientCount} patients`} icon={AlertTriangle} tone="amber" />
            <Kpi label="Lab Fees" value={formatCurrency(summary.labFeesTotal)} sub={summary.pendingLabFeesCount > 0 ? `${summary.pendingLabFeesCount} pending` : undefined} icon={Activity} />
          </div>

          {/* Revenue & Expense Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue &amp; Expenses — Last 12 Months</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <ComposedChart data={revenueTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => formatCurrency(v).replace('EGP ', '')} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill={COLORS.green} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill={COLORS.red} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="net" name="Net Income" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Patient Growth */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient Growth — Last 12 Months</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <ComposedChart data={patientGrowth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={40} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={40} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="newPatients" name="New Patients" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativePatients" name="Total Patients" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods + Lab Fees */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('Method')} Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {summary.paymentMethodBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No payments in this period.</p>
                ) : (
                  <>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={summary.paymentMethodBreakdown}
                            dataKey="total"
                            nameKey="method"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {summary.paymentMethodBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {summary.paymentMethodBreakdown.map((m, i) => (
                        <div key={m.method} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            {formatPaymentMethod(m.method)}
                          </span>
                          <span className="font-medium">{formatCurrency(m.total)} <span className="text-muted-foreground">({m.pct.toFixed(0)}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {t('Lab Fees')} by Lab
                  {summary.pendingLabFeesCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {summary.pendingLabFeesCount} pending entry
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary.labFeesBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No lab fees attributed in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {summary.labFeesBreakdown.map((l, i) => (
                      <div key={l.lab_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{l.lab_name || 'Unknown'}</span>
                          <span className="font-medium">{formatCurrency(l.total)} <span className="text-muted-foreground">({l.pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${l.pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm font-semibold border-t pt-2 mt-2">
                      <span>Total</span>
                      <span>{formatCurrency(summary.labFeesTotal)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Doctor Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Doctor Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.doctorPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No doctor activity in this period.</p>
              ) : (
                <>
                  <div style={{ width: '100%', height: Math.max(180, summary.doctorPerformance.length * 48) }}>
                    <ResponsiveContainer>
                      <BarChart data={summary.doctorPerformance} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v).replace('EGP ', '')} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto mt-4">
                    <table className="text-sm" style={{ minWidth: '600px', width: '100%' }}>
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Doctor</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Cases</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Revenue</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Avg / Case</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Earnings</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">% of Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.doctorPerformance.map((d) => (
                          <tr key={d.doctorId} className="border-b last:border-0">
                            <td className="px-3 py-2 whitespace-nowrap font-medium">{d.name}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{getDoctorTypeLabel(d)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{d.caseCount}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{formatCurrency(d.revenue)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(d.avgPerCase)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap text-primary font-medium">{formatCurrency(d.earnings)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{d.pctOfRevenue.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top Patients + Assistant Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Patients</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {summary.topPatients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No patients in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-sm" style={{ minWidth: '400px', width: '100%' }}>
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">{t('Patient')}</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Visits</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topPatients.map((p) => (
                          <tr key={p.patientId} className="border-b last:border-0">
                            <td className="px-4 py-2.5 whitespace-nowrap font-medium">{p.name}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">{p.visitCount}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">{formatCurrency(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assistant Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {summary.assistantActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No activity in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-sm" style={{ minWidth: '400px', width: '100%' }}>
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Assistant</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Transactions</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Revenue Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.assistantActivity.map((a) => (
                          <tr key={a.assistantId} className="border-b last:border-0">
                            <td className="px-4 py-2.5 whitespace-nowrap font-medium">{a.name}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">{a.count}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium">{formatCurrency(a.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Expense Breakdown + Day-of-Week pattern */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Expense Categories</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {summary.expenseBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No expenses in this period.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-sm" style={{ minWidth: '400px', width: '100%' }}>
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Description</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Count</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.expenseBreakdown.map((e) => (
                          <tr key={e.description} className="border-b last:border-0">
                            <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">{e.count}</td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap font-medium text-red-600">{formatCurrency(e.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue by Day of Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={summary.dayOfWeekBreakdown} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={60} tickFormatter={(v) => formatCurrency(v).replace('EGP ', '')} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Outstanding balance is a live snapshot as of today; all other figures reflect the selected date range ({rangeLabel}).
          </p>
        </>
      )}
    </div>
  );
}
