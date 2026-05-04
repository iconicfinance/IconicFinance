import React from 'react';
import { Banknote } from 'lucide-react';

interface PaymentMethodIconProps {
  method: 'cash' | 'vodafone_cash' | 'instapay' | string | null;
  size?: number;
  className?: string;
}

export function PaymentMethodIcon({ method, size = 36, className = '' }: PaymentMethodIconProps) {
  if (method === 'vodafone_cash') {
    return (
      <img
        src="/logos/vodafone-cash.png"
        alt="Vodafone Cash"
        style={{ width: size, height: size, objectFit: 'contain' }}
        className={className}
      />
    );
  }

  if (method === 'instapay') {
    return (
      <img
        src="/logos/instapay.png"
        alt="InstaPay"
        style={{ width: size, height: size, objectFit: 'contain' }}
        className={className}
      />
    );
  }

  // Cash — use a banknote icon
  return <Banknote size={size} className={`text-green-600 ${className}`} />;
}
