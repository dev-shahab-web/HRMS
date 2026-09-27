import { describe, expect, it } from 'vitest';

import { currencyExponent, Money, roundedDiv } from './money';

describe('Money.fromDecimal', () => {
  it('parses a two-decimal amount into minor units', () => {
    const m = Money.fromDecimal('1234.56', 'INR');
    expect(m.minorUnits).toBe(123456n);
    expect(m.currency).toBe('INR');
  });

  it('pads missing fractional digits', () => {
    expect(Money.fromDecimal('10', 'USD').minorUnits).toBe(1000n);
    expect(Money.fromDecimal('10.5', 'USD').minorUnits).toBe(1050n);
  });

  it('handles negative amounts', () => {
    expect(Money.fromDecimal('-0.01', 'USD').minorUnits).toBe(-1n);
  });

  it('normalizes lower-case currency codes', () => {
    expect(Money.fromDecimal('1.00', 'usd').currency).toBe('USD');
  });

  it('respects zero-decimal currencies (JPY)', () => {
    expect(currencyExponent('JPY')).toBe(0);
    expect(Money.fromDecimal('1500', 'JPY').minorUnits).toBe(1500n);
    expect(() => Money.fromDecimal('1500.5', 'JPY')).toThrow();
  });

  it('respects three-decimal currencies (KWD)', () => {
    expect(currencyExponent('KWD')).toBe(3);
    expect(Money.fromDecimal('1.234', 'KWD').minorUnits).toBe(1234n);
  });

  it('rejects more fractional digits than the currency allows', () => {
    expect(() => Money.fromDecimal('1.234', 'USD')).toThrow();
  });

  it('rejects malformed input and bad currencies', () => {
    expect(() => Money.fromDecimal('abc', 'USD')).toThrow();
    expect(() => Money.fromDecimal('', 'USD')).toThrow();
    expect(() => Money.fromDecimal('1.00', 'US')).toThrow();
  });
});

describe('Money arithmetic', () => {
  it('adds and subtracts within the same currency', () => {
    const a = Money.fromDecimal('10.00', 'USD');
    const b = Money.fromDecimal('2.50', 'USD');
    expect(a.add(b).toDecimalString()).toBe('12.50');
    expect(a.subtract(b).toDecimalString()).toBe('7.50');
  });

  it('throws on currency mismatch', () => {
    const usd = Money.ofMinor(100n, 'USD');
    const inr = Money.ofMinor(100n, 'INR');
    expect(() => usd.add(inr)).toThrow();
    expect(() => usd.subtract(inr)).toThrow();
    expect(() => usd.compareTo(inr)).toThrow();
  });

  it('negate / abs / sign predicates', () => {
    const negative = Money.fromDecimal('-5.00', 'USD');
    expect(negative.isNegative()).toBe(true);
    expect(negative.abs().toDecimalString()).toBe('5.00');
    expect(negative.negate().toDecimalString()).toBe('5.00');
    expect(Money.zero('USD').isZero()).toBe(true);
  });

  it('equals is currency-aware', () => {
    expect(Money.ofMinor(100n, 'USD').equals(Money.ofMinor(100n, 'USD'))).toBe(true);
    expect(Money.ofMinor(100n, 'USD').equals(Money.ofMinor(100n, 'INR'))).toBe(false);
  });

  it('orders values', () => {
    const a = Money.fromDecimal('1.00', 'USD');
    const b = Money.fromDecimal('2.00', 'USD');
    expect(a.lessThan(b)).toBe(true);
    expect(b.greaterThan(a)).toBe(true);
    expect(a.lessThanOrEqual(a)).toBe(true);
    expect(a.greaterThanOrEqual(a)).toBe(true);
  });
});

describe('Money.toDecimalString', () => {
  it('formats small and negative values with padding', () => {
    expect(Money.ofMinor(5n, 'USD').toDecimalString()).toBe('0.05');
    expect(Money.ofMinor(-5n, 'USD').toDecimalString()).toBe('-0.05');
    expect(Money.ofMinor(0n, 'USD').toDecimalString()).toBe('0.00');
    expect(Money.ofMinor(1500n, 'JPY').toDecimalString()).toBe('1500');
  });

  it('round-trips through fromDecimal', () => {
    for (const value of ['0.00', '0.01', '1234.56', '-99.99']) {
      expect(Money.fromDecimal(value, 'USD').toDecimalString()).toBe(value);
    }
  });

  it('serializes losslessly to JSON', () => {
    expect(Money.fromDecimal('1234.56', 'INR').toJSON()).toEqual({
      minorUnits: '123456',
      currency: 'INR',
    });
    expect(Money.ofMinor(123456n, 'INR').toString()).toBe('INR 1234.56');
  });
});

describe('roundedDiv', () => {
  it('rounds half to even (banker’s rounding)', () => {
    expect(roundedDiv(5n, 2n, 'HALF_EVEN')).toBe(2n); // 2.5 -> 2
    expect(roundedDiv(7n, 2n, 'HALF_EVEN')).toBe(4n); // 3.5 -> 4
  });

  it('rounds half up, symmetric across sign', () => {
    expect(roundedDiv(5n, 2n, 'HALF_UP')).toBe(3n);
    expect(roundedDiv(-5n, 2n, 'HALF_UP')).toBe(-3n);
  });

  it('DOWN truncates toward zero, UP rounds away from zero', () => {
    expect(roundedDiv(7n, 3n, 'DOWN')).toBe(2n);
    expect(roundedDiv(7n, 3n, 'UP')).toBe(3n);
    expect(roundedDiv(-7n, 3n, 'DOWN')).toBe(-2n);
    expect(roundedDiv(-7n, 3n, 'UP')).toBe(-3n);
  });

  it('returns exact quotient when evenly divisible', () => {
    expect(roundedDiv(6n, 3n, 'HALF_EVEN')).toBe(2n);
  });

  it('throws on a non-positive denominator', () => {
    expect(() => roundedDiv(1n, 0n, 'HALF_UP')).toThrow();
    expect(() => roundedDiv(1n, -2n, 'HALF_UP')).toThrow();
  });
});

describe('Money.multiplyByRatio', () => {
  it('computes a percentage exactly (12.5% of 100.00)', () => {
    const tax = Money.fromDecimal('100.00', 'USD').multiplyByRatio(125n, 1000n);
    expect(tax.toDecimalString()).toBe('12.50');
  });

  it('rounds a repeating division (10.00 / 3)', () => {
    const third = Money.fromDecimal('10.00', 'USD').multiplyByRatio(1n, 3n);
    expect(third.toDecimalString()).toBe('3.33');
  });
});
