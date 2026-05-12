import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, Loader, Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTransactionsByDateRange, type Transaction } from '@/services/transactions';
import { getActiveDoctors, type Doctor } from '@/services/doctors';
import { formatCurrency, formatDate, formatTime, formatPaymentMethod } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AssistantHistory() {
  const location = useLocation();
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pre-fill search if a patient name was passed via router state
  const [search, setSearch] = useState(
    (location.state as { patientName?: string } | null)?.patientName || ''
  );

  const getDoctorName = (id: string | null) =>
    doctors.find((d) => d.id === id)?.name || '—';

  useEffect(() => {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);

    Promise.allSettled([
      getTransactionsByDateRange(from, to),
      getActiveDoctors(),
    ]).then(([txResult, docResult]) => {
      if (txResult.status === 'fulfilled') setTransactions(txResult.value);
      else setError((txResult.reason as any)?.message || 'Failed to load history');
      if (docResult.status === 'fulfilled') setDoctors(docResult.value);
    }).finally(() => setLoading(false));
  }, []);

  const query = search.toLowerCase();
  const filtered = transactions.filter((tx) => {
    if (!query) return true;
    return (
      tx.patient_name?.toLowerCase().includes(query) ||
      tx.expense_description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('Transaction History')}</h1>
        <p className="text-muted-foreground text-sm mt-1">Last 30 days — read only</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('Search...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {t('All Transactions')}
            <Badge variant="secondary" className="ml-auto">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">{t('Loading...')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? 'No results match your search.' : 'No transactions in the last 30 days.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm" style={{ minWidth: '800px', width: '100%' }}>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Date')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Patient')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Doctor')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Method')}</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Lab Fees')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{t('Notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                        tx.lab_fees_pending ? 'bg-amber-50 hover:bg-amber-100' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatTime(tx.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'payment_in' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Payment In</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Expense Out</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.patient_name ? (
                          <button
                            type="button"
                            onClick={() => setSearch(tx.patient_name!)}
                            className="text-primary underline-offset-2 hover:underline font-medium"
                          >
                            {tx.patient_name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {tx.type === 'payment_in' ? getDoctorName(tx.doctor_id) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatPaymentMethod(tx.payment_method)}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(tx.final_amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.type === 'payment_in' ? (
                          tx.lab_fees_pending ? (
                            <span className="flex items-center gap-1 text-amber-600 font-medium text-xs">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Pending
                            </span>
                          ) : tx.has_lab_fees ? (
                            <span className="text-green-600 text-xs">{formatCurrency(tx.lab_fees_amount)}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">None</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.expense_description || <span className="opacity-40">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
