/**
 * Money value object. Amounts are stored as integer **minor units** in a
 * `bigint`, tagged with an ISO-4217 currency. There is no floating point
 * anywhere in this module — parsing, arithmetic, and rounding are exact.
 *
 * Rationale (CLAUDE.md §6): floats cannot represent decimal fractions like
 * 0.10 exactly, so accumulating them in payroll/tax silently drifts by cents.
 * `Money` is immutable; every operation returns a new instance.
 */

import { InternalError, ValidationFailed } from './errors';
import { assertNever } from './types';
import type { CurrencyCode } from './types';

/**
 * How to resolve a fractional minor unit produced by division.
 * `DOWN`/`UP` are relative to zero (truncate toward / away from zero).
 * `HALF_EVEN` (banker's rounding) is the default for proration and tax.
 */
export type RoundingMode = 'DOWN' | 'UP' | 'HALF_UP' | 'HALF_DOWN' | 'HALF_EVEN';

/**
 * Number of fractional digits (minor-unit exponent) per currency.
 * Most currencies are 2; this table lists the real-world exceptions.
 * Anything not listed defaults to 2. See ISO-4217.
 */
const CURRENCY_EXPONENTS: Readonly<Record<string, number>> = {
  // Zero-decimal currencies
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  XOF: 0,
  XAF: 0,
  XPF: 0,
  UGX: 0,
  RWF: 0,
  // Three-decimal currencies
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  IQD: 3,
  JOD: 3,
  LYD: 3,
};

const DEFAULT_EXPONENT = 2;

/** Fractional-digit count for a currency (2 unless the table says otherwise). */
export function currencyExponent(currency: CurrencyCode): number {
  return CURRENCY_EXPONENTS[currency] ?? DEFAULT_EXPONENT;
}

function normalizeCurrency(currency: string): CurrencyCode {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new ValidationFailed(`Invalid currency code: "${currency}".`);
  }
  return normalized;
}

/**
 * Exact integer division with a rounding mode. `denominator` must be positive;
 * the sign of `numerator` is preserved. Used for proration and ratio math.
 */
export function roundedDiv(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator <= 0n) {
    throw new InternalError('roundedDiv: denominator must be a positive bigint.');
  }
  const negative = numerator < 0n;
  const absNumerator = negative ? -numerator : numerator;
  const quotient = absNumerator / denominator;
  const remainder = absNumerator % denominator;
  if (remainder === 0n) {
    return negative ? -quotient : quotient;
  }

  const twiceRemainder = remainder * 2n;
  let roundAwayFromZero: boolean;
  switch (mode) {
    case 'DOWN':
      roundAwayFromZero = false;
      break;
    case 'UP':
      roundAwayFromZero = true;
      break;
    case 'HALF_UP':
      roundAwayFromZero = twiceRemainder >= denominator;
      break;
    case 'HALF_DOWN':
      roundAwayFromZero = twiceRemainder > denominator;
      break;
    case 'HALF_EVEN':
      if (twiceRemainder > denominator) {
        roundAwayFromZero = true;
      } else if (twiceRemainder < denominator) {
        roundAwayFromZero = false;
      } else {
        // Exactly halfway: round to the even quotient.
        roundAwayFromZero = quotient % 2n === 1n;
      }
      break;
    default:
      return assertNever(mode, 'Unknown rounding mode');
  }

  const magnitude = roundAwayFromZero ? quotient + 1n : quotient;
  return negative ? -magnitude : magnitude;
}

export class Money {
  /** Amount in minor units (e.g. paise, cents). Never a float. */
  readonly minorUnits: bigint;
  /** ISO-4217 currency code, always upper-case. */
  readonly currency: CurrencyCode;

  private constructor(minorUnits: bigint, currency: CurrencyCode) {
    this.minorUnits = minorUnits;
    this.currency = currency;
  }

  /** Construct from an integer amount already expressed in minor units. */
  static ofMinor(minorUnits: bigint | number | string, currency: CurrencyCode): Money {
    const normalizedCurrency = normalizeCurrency(currency);
    let units: bigint;
    if (typeof minorUnits === 'bigint') {
      units = minorUnits;
    } else if (typeof minorUnits === 'number') {
      if (!Number.isInteger(minorUnits)) {
        throw new ValidationFailed(`Minor units must be an integer, received ${minorUnits}.`);
      }
      units = BigInt(minorUnits);
    } else {
      const trimmed = minorUnits.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        throw new ValidationFailed(`Invalid minor units: "${minorUnits}".`);
      }
      units = BigInt(trimmed);
    }
    return new Money(units, normalizedCurrency);
  }

  /**
   * Parse a human decimal string (e.g. `"1234.56"`) into minor units, exactly.
   * Rejects amounts with more fractional digits than the currency allows, so
   * precision is never silently discarded.
   */
  static fromDecimal(value: string, currency: CurrencyCode): Money {
    const normalizedCurrency = normalizeCurrency(currency);
    const exponent = currencyExponent(normalizedCurrency);
    const match = /^\s*(-)?(\d+)(?:\.(\d+))?\s*$/.exec(value);
    if (!match) {
      throw new ValidationFailed(`Invalid decimal amount: "${value}".`);
    }
    const [, sign, intPartRaw, fracPartRaw] = match;
    const intPart = intPartRaw ?? '0';
    const fracPart = fracPartRaw ?? '';
    if (fracPart.length > exponent) {
      throw new ValidationFailed(
        `Amount "${value}" has more fractional digits than ${normalizedCurrency} supports (${exponent}).`,
      );
    }
    const paddedFrac = fracPart.padEnd(exponent, '0');
    const units = BigInt(`${intPart}${paddedFrac}`);
    return new Money(sign === '-' ? -units : units, normalizedCurrency);
  }

  /** Zero in the given currency. */
  static zero(currency: CurrencyCode): Money {
    return new Money(0n, normalizeCurrency(currency));
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationFailed(
        `Currency mismatch: cannot combine ${this.currency} with ${other.currency}.`,
      );
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  negate(): Money {
    return new Money(-this.minorUnits, this.currency);
  }

  abs(): Money {
    return this.minorUnits < 0n ? this.negate() : this;
  }

  /**
   * Multiply by the rational `numerator / denominator` and round back to a whole
   * minor unit. Use this for percentages (e.g. 12.5% → 125/1000), proration, and
   * splits — it keeps the computation exact until the single final rounding.
   */
  multiplyByRatio(
    numerator: bigint,
    denominator: bigint,
    mode: RoundingMode = 'HALF_EVEN',
  ): Money {
    return new Money(roundedDiv(this.minorUnits * numerator, denominator, mode), this.currency);
  }

  /** -1, 0, or 1. Throws on currency mismatch. */
  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  greaterThan(other: Money): boolean {
    return this.compareTo(other) > 0;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compareTo(other) >= 0;
  }

  lessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.compareTo(other) <= 0;
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  /** Render as a plain decimal string, e.g. `"1234.56"` (or `"1234"` for JPY). */
  toDecimalString(): string {
    const exponent = currencyExponent(this.currency);
    const negative = this.minorUnits < 0n;
    const digits = (negative ? -this.minorUnits : this.minorUnits).toString();
    if (exponent === 0) {
      return `${negative ? '-' : ''}${digits}`;
    }
    const padded = digits.padStart(exponent + 1, '0');
    const splitAt = padded.length - exponent;
    return `${negative ? '-' : ''}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
  }

  /** Human-readable, e.g. `"INR 1234.56"`. */
  toString(): string {
    return `${this.currency} ${this.toDecimalString()}`;
  }

  /**
   * Lossless serialization. `minorUnits` is a string because `bigint` is not
   * JSON-serializable; API serializers may reshape this into `{ amount, currency }`.
   */
  toJSON(): { minorUnits: string; currency: CurrencyCode } {
    return { minorUnits: this.minorUnits.toString(), currency: this.currency };
  }
}
