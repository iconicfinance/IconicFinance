import { getSupabaseClient } from '@/lib/supabase';
import { getTransactionsByDateRange, type Transaction } from '@/services/transactions';
import { getAllDoctors, getDoctorDisplayName, type Doctor } from '@/services/doctors';
import { getAllOutstandingBalances } from '@/services/patientBalance';
import { getLabFeesForRange } from '@/services/transactionLabFees';

export interface AnalyticsSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  caseCount: number;
  avgTransactionValue: number;
  uniquePatients: number;
  newPatients: number;
  outstandingTotal: number;
  outstandingPatientCount: number;
  paymentMethodBreakdown: { method: string; total: number; count: number; pct: number }[];
  doctorPerformance: {
    doctorId: string; name: string; type: string;
    custom_label: string | null; custom_percentage: number | null;
    revenue: number; caseCount: number; earnings: number;
    avgPerCase: number; pctOfRevenue: number;
  }[];
  topPatients: { patientId: string; name: string; revenue: number; visitCount: number }[];
  labFeesTotal: number;
  labFeesBreakdown: { lab_id: string; lab_name: string; total: number; pct: number }[];
  pendingLabFeesCount: number;
  expenseBreakdown: { description: string; total: number; count: number }[];
  assistantActivity: { assistantId: string; name: string; revenue: number; count: number }[];
  dayOfWeekBreakdown: { day: string; revenue: number; count: number }[];
}

export interface MonthBucket {
  label: string;
  sortKey: number;
  revenue: number;
  expenses: number;
  net: number;
}

export interface PatientGrowthBucket {
  label: string;
  sortKey: number;
  newPatients: number;
  cumulativePatients: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Earliest payment_in date per patient, across all time — used to classify new vs returning.
const getPatientFirstVisitMap = async (): Promise<Map<string, number>> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('patient_id, created_at')
    .eq('type', 'payment_in')
    .not('patient_id', 'is', null);
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of (data || []) as { patient_id: string; created_at: string }[]) {
    const ts = new Date(row.created_at).getTime();
    const existing = map.get(row.patient_id);
    if (existing === undefined || ts < existing) map.set(row.patient_id, ts);
  }
  return map;
};

export const getAnalyticsSummary = async (from: Date, to: Date): Promise<AnalyticsSummary> => {
  const [allTx, doctors, labFees, outstanding, firstVisitMap] = await Promise.all([
    getTransactionsByDateRange(from, to),
    getAllDoctors(),
    getLabFeesForRange(from, to),
    getAllOutstandingBalances(),
    getPatientFirstVisitMap(),
  ]);

  const payments = allTx.filter((t) => t.type === 'payment_in');
  const expenses = allTx.filter((t) => t.type === 'expense_out');

  const totalRevenue = payments.reduce((s, t) => s + Number(t.final_amount), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.final_amount), 0);
  const netIncome = totalRevenue - totalExpenses;
  const caseCount = payments.length;
  const avgTransactionValue = caseCount ? totalRevenue / caseCount : 0;

  const patientIds = new Set(payments.filter((t) => t.patient_id).map((t) => t.patient_id as string));
  const uniquePatients = patientIds.size;
  const fromTs = from.getTime();
  const toTs = to.getTime();
  let newPatients = 0;
  for (const pid of patientIds) {
    const first = firstVisitMap.get(pid);
    if (first !== undefined && first >= fromTs && first < toTs) newPatients++;
  }

  const outstandingTotal = outstanding.reduce((s, b) => s + (b.total_due - b.total_paid), 0);
  const outstandingPatientCount = new Set(outstanding.map((b) => b.patient_id)).size;

  // Payment method breakdown
  const methodMap = new Map<string, { total: number; count: number }>();
  for (const t of payments) {
    const m = t.payment_method || 'unspecified';
    const cur = methodMap.get(m) || { total: 0, count: 0 };
    cur.total += Number(t.final_amount); cur.count++;
    methodMap.set(m, cur);
  }
  const paymentMethodBreakdown = [...methodMap.entries()]
    .map(([method, v]) => ({ method, total: v.total, count: v.count, pct: totalRevenue ? (v.total / totalRevenue) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // Doctor performance
  const doctorMap = new Map<string, { revenue: number; caseCount: number; earnings: number }>();
  for (const t of payments) {
    if (!t.doctor_id) continue;
    const cur = doctorMap.get(t.doctor_id) || { revenue: 0, caseCount: 0, earnings: 0 };
    cur.revenue += Number(t.final_amount); cur.caseCount++; cur.earnings += Number(t.doctor_earnings);
    doctorMap.set(t.doctor_id, cur);
  }
  const doctorById = new Map(doctors.map((d) => [d.id, d]));
  const doctorPerformance = [...doctorMap.entries()]
    .map(([id, v]) => {
      const doc: Doctor | undefined = doctorById.get(id);
      return {
        doctorId: id,
        name: doc ? getDoctorDisplayName(doc) : 'Unknown',
        type: doc?.type || 'unknown',
        custom_label: doc?.custom_label ?? null,
        custom_percentage: doc?.custom_percentage ?? null,
        revenue: v.revenue,
        caseCount: v.caseCount,
        earnings: v.earnings,
        avgPerCase: v.caseCount ? v.revenue / v.caseCount : 0,
        pctOfRevenue: totalRevenue ? (v.revenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Top patients
  const patientMap = new Map<string, { name: string; revenue: number; visitCount: number }>();
  for (const t of payments) {
    if (!t.patient_id) continue;
    const cur = patientMap.get(t.patient_id) || { name: t.patient_name || '—', revenue: 0, visitCount: 0 };
    cur.revenue += Number(t.final_amount); cur.visitCount++;
    patientMap.set(t.patient_id, cur);
  }
  const topPatients = [...patientMap.entries()]
    .map(([patientId, v]) => ({ patientId, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Lab fees
  const labFeesTotal = labFees.reduce((s, l) => s + l.total, 0);
  const labFeesBreakdown = labFees
    .map((l) => ({ ...l, pct: labFeesTotal ? (l.total / labFeesTotal) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
  const pendingLabFeesCount = payments.filter((t) => t.lab_fees_pending).length;

  // Expense breakdown by description
  const expenseMap = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const desc = t.expense_description?.trim() || 'Other';
    const cur = expenseMap.get(desc) || { total: 0, count: 0 };
    cur.total += Number(t.final_amount); cur.count++;
    expenseMap.set(desc, cur);
  }
  const expenseBreakdown = [...expenseMap.entries()]
    .map(([description, v]) => ({ description, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Assistant activity
  const assistantMap = new Map<string, { name: string; revenue: number; count: number }>();
  for (const t of payments) {
    const cur = assistantMap.get(t.assistant_id) || { name: t.assistant_name, revenue: 0, count: 0 };
    cur.revenue += Number(t.final_amount); cur.count++;
    assistantMap.set(t.assistant_id, cur);
  }
  const assistantActivity = [...assistantMap.entries()]
    .map(([assistantId, v]) => ({ assistantId, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Day-of-week pattern
  const dowMap = new Map<number, { revenue: number; count: number }>();
  for (const t of payments) {
    const d = new Date(t.created_at).getDay();
    const cur = dowMap.get(d) || { revenue: 0, count: 0 };
    cur.revenue += Number(t.final_amount); cur.count++;
    dowMap.set(d, cur);
  }
  const dayOfWeekBreakdown = DAY_NAMES.map((day, i) => ({
    day, revenue: dowMap.get(i)?.revenue ?? 0, count: dowMap.get(i)?.count ?? 0,
  }));

  return {
    totalRevenue, totalExpenses, netIncome, caseCount, avgTransactionValue,
    uniquePatients, newPatients, outstandingTotal, outstandingPatientCount,
    paymentMethodBreakdown, doctorPerformance, topPatients,
    labFeesTotal, labFeesBreakdown, pendingLabFeesCount,
    expenseBreakdown, assistantActivity, dayOfWeekBreakdown,
  };
};

// Revenue/expense trend for the trailing N months (always calendar months, independent of any filter)
export const getRevenueTrend = async (monthsBack = 12): Promise<MonthBucket[]> => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const allTx = await getTransactionsByDateRange(from, to);

  const buckets: MonthBucket[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1) + i, 1);
    buckets.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      sortKey: d.getTime(),
      revenue: 0, expenses: 0, net: 0,
    });
  }

  for (const t of allTx) {
    const d = new Date(t.created_at);
    const bucketStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const bucket = buckets.find((b) => b.sortKey === bucketStart);
    if (!bucket) continue;
    if (t.type === 'payment_in') bucket.revenue += Number(t.final_amount);
    else bucket.expenses += Number(t.final_amount);
  }

  buckets.forEach((b) => { b.net = b.revenue - b.expenses; });
  return buckets;
};

// New-patient & cumulative-patient growth for the trailing N months
export const getPatientGrowthTrend = async (monthsBack = 12): Promise<PatientGrowthBucket[]> => {
  const firstVisitMap = await getPatientFirstVisitMap();
  const now = new Date();

  const buckets: PatientGrowthBucket[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1) + i, 1);
    buckets.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      sortKey: d.getTime(),
      newPatients: 0, cumulativePatients: 0,
    });
  }

  const windowStart = buckets[0].sortKey;
  let priorCount = 0;
  for (const ts of firstVisitMap.values()) {
    if (ts < windowStart) { priorCount++; continue; }
    const d = new Date(ts);
    const bucketStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const bucket = buckets.find((b) => b.sortKey === bucketStart);
    if (bucket) bucket.newPatients++;
  }

  let cumulative = priorCount;
  for (const b of buckets) {
    cumulative += b.newPatients;
    b.cumulativePatients = cumulative;
  }
  return buckets;
};
