import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { createExpenseOut } from '@/services/transactions';
import { useLanguage } from '@/contexts/LanguageContext';
import { toDatetimeLocalValue, minBackdateValue, maxBackdateValue, parseBackdatedDateTime } from '@/lib/utils';

export default function AssistantAddExpense() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const successRoute =
    user?.role === 'admin' ? '/admin/dashboard'
    : user?.role === 'doctor' ? '/doctor/dashboard'
    : '/assistant/today';

  // Backdating is an assistant-only affordance — doctors/admins reach this same
  // component via the shared /add-payment /add-expense routes.
  const canBackdate = user?.role === 'assistant';

  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vodafone_cash' | 'instapay' | ''>('');
  const [amount, setAmount] = useState('');
  const [logMode, setLogMode] = useState<'today' | 'previous'>('today');
  const [pickedDateTime, setPickedDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!description.trim()) {
      setError('Expense description is required.');
      return;
    }
    if (!paymentMethod) {
      setError('Please select a payment method.');
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amount || amountNum <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    let createdAt: string | undefined;
    if (canBackdate && logMode === 'previous') {
      const result = parseBackdatedDateTime(pickedDateTime);
      if (result.error) {
        setError(t(result.error));
        return;
      }
      createdAt = result.date.toISOString();
    }

    setError('');
    setLoading(true);

    try {
      await createExpenseOut({
        assistant_id: user.id,
        assistant_name: user.full_name,
        final_amount: amountNum,
        expense_description: description.trim(),
        payment_method: paymentMethod,
        ...(createdAt ? { created_at: createdAt } : {}),
      });

      setSuccess(true);
      setTimeout(() => navigate(successRoute), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to record expense.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-xl font-semibold">{t('Expense Recorded!')}</h2>
        <p className="text-muted-foreground">Redirecting to today's view...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('Add Expense')}</h1>
        <p className="text-muted-foreground text-sm mt-1">Record a new clinic expense</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {canBackdate && (
              <div className="space-y-2">
                <Label>{t('Log for')}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={logMode === 'today' ? 'default' : 'outline'}
                    onClick={() => setLogMode('today')}
                    className="flex-1"
                  >
                    {t('Today')}
                  </Button>
                  <Button
                    type="button"
                    variant={logMode === 'previous' ? 'default' : 'outline'}
                    onClick={() => {
                      setLogMode('previous');
                      if (!pickedDateTime) setPickedDateTime(toDatetimeLocalValue(new Date()));
                    }}
                    className="flex-1"
                  >
                    {t('Previous date')}
                  </Button>
                </div>
                {logMode === 'previous' && (
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="expense-datetime">{t('Date & time')} *</Label>
                    <Input
                      id="expense-datetime"
                      type="datetime-local"
                      value={pickedDateTime}
                      onChange={(e) => setPickedDateTime(e.target.value)}
                      min={minBackdateValue()}
                      max={maxBackdateValue()}
                      dir="ltr"
                    />
                    <p className="text-xs text-muted-foreground">{t('You can backdate up to 30 days ago.')}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder={t('Notes (optional)')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('Payment Method')} *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('Cash')}</SelectItem>
                  <SelectItem value="vodafone_cash">{t('Vodafone Cash')}</SelectItem>
                  <SelectItem value="instapay">{t('Instapay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (EGP) *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(successRoute)}
                className="flex-1"
              >
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? t('Saving...') : t('Record Expense')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
