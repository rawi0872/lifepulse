export function getSupportEmail(): string {
  if (
    typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_SUPPORT_EMAIL &&
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL !== "your_support_email@example.com"
  ) {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  }
  return "support@lifepulse.app";
}

const DEFAULT_APP_CURRENCY = "ILS";

/**
 * Returns the currency code to use across the app.
 * Set NEXT_PUBLIC_APP_CURRENCY in your environment to override (e.g. "ILS", "EUR", "GBP").
 * Defaults to "ILS" when the variable is absent or invalid.
 */
export function getAppCurrency(): string {
  const env =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_CURRENCY
      : undefined;
  const currency = env?.trim().toUpperCase();

  if (currency && /^[A-Z]{3}$/.test(currency)) return currency;
  return DEFAULT_APP_CURRENCY;
}

/**
 * Format a monetary amount using the app currency.
 * `fractionDigits` defaults to 0 for compact display (e.g. dashboard cards).
 */
export function formatMoney(
  amount: number,
  fractionDigits = 0,
  currency?: string,
): string {
  const cur = currency ?? getAppCurrency();
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(safeAmount);
  } catch {
    return `${DEFAULT_APP_CURRENCY} ${safeAmount.toFixed(fractionDigits)}`;
  }
}
