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

// ── Backdating (assistant "log for a previous date" forms) ────────────────────

export const MAX_BACKDATE_DAYS = 30;

const pad2 = (n: number) => String(n).padStart(2, "0");

// Formats a Date as the value a <input type="datetime-local"> expects (local time, no timezone).
export const toDatetimeLocalValue = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const minBackdateValue = (): string =>
  toDatetimeLocalValue(new Date(Date.now() - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000));

export const maxBackdateValue = (): string => toDatetimeLocalValue(new Date());

// Parses a datetime-local value and validates it falls within the allowed backdate window.
// Returns { date } on success or { error } on failure (a translation-lookup key).
export const parseBackdatedDateTime = (
  value: string,
): { date: Date; error?: undefined } | { date?: undefined; error: string } => {
  if (!value) return { error: "Please select a date and time." };
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return { error: "Please select a valid date and time." };
  const now = Date.now();
  if (parsed.getTime() > now) return { error: "Date and time cannot be in the future." };
  if (parsed.getTime() < now - MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000) {
    return { error: "Date cannot be more than 30 days ago." };
  }
  return { date: parsed };
};
