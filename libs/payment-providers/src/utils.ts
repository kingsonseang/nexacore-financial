/*
 * Converts integer minor units (50000) to a decimal amount string ("500.00")
 * without relying on floating point arithmetic, to keep monetary formatting
 * consistent and predictable across the app.
 */
export const fromMinorUnits = (minorUnits: number): string => {
  const whole = Math.floor(minorUnits / 100)
  const fraction = minorUnits % 100
  return `${whole}.${fraction.toString().padStart(2, '0')}`
}

/*
 * Converts a decimal amount string ("500.00") to integer minor units (50000)
 * without floating point arithmetic, since parseFloat(amount) * 100 risks
 * precision errors on certain decimal values. Consistent with this project's
 * existing convention of treating monetary amounts as strings end-to-end.
 */
export const toMinorUnits = (amount: string): number => {
  const [whole, fraction = '0'] = amount.split('.')
  const paddedFraction = fraction.padEnd(2, '0').slice(0, 2)
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(paddedFraction, 10)
}
