import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "—";
  return `EGP ${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const formatTime = (dateStr: string): string =>
  new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDateTime = (dateStr: string): string =>
  `${formatDate(dateStr)}, ${formatTime(dateStr)}`;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  vodafone_cash: "Vodafone Cash",
  instapay: "Instapay",
};

export const formatPaymentMethod = (method: string | null | undefined): string => {
  if (!method) return "—";
  return PAYMENT_METHOD_LABELS[method] || method;
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const formatMonth = (month: number, year: number): string =>
  `${MONTH_NAMES[month - 1]} ${year}`;
