/**
 * Formats a number to Indian Rupee (INR) with Lakhs/Crores suffixes.
 * E.g., 42000000 -> "₹4.20 Cr"
 *        1500000 -> "₹15.00 L"
 *          75000 -> "₹75,000"
 */
export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Formats a number to a percentage.
 */
export function formatPercentage(val: number): string {
  return `${val.toFixed(1)}%`;
}

/**
 * Formats a short date for dashboard tables.
 */
export function formatDateShort(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
