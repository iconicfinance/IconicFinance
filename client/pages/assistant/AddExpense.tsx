import React, { useState } from 'react';
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

export default function AssistantAddExpense() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const successRoute =
    user?.role === 'admin' ? '/admin/dashboard'
    : user?.role === 'doctor' ? '/doctor/dashboard'
    : '/assistant/today';

  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'vodafone_cash' | 'instapay' | ''>('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

    setError('');
    setLoading(true);

    try {
      await createExpenseOut({
        assistant_id: user.id,
        assistant_name: user.full_name,
        final_amount: amountNum,
        expense_description: description.trim(),
        payment_method: paymentMethod,
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
        <h2 className="text-xl font-semibold">Expense Recorded!</h2>
        <p className="text-muted-foreground">Redirecting to today's view...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Expense</h1>
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

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="What was this expense for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="vodafone_cash">Vodafone Cash</SelectItem>
                  <SelectItem value="instapay">Instapay</SelectItem>
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
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? 'Saving...' : 'Confirm Expense'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
