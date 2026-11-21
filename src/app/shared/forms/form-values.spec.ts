import { blankToNull, numberOrNull } from './form-values';

describe('form value helpers', () => {
  it('turns blank text into null and trims the rest', () => {
    expect(blankToNull('   ')).toBeNull();
    expect(blankToNull(null)).toBeNull();
    expect(blankToNull('  DZD  ')).toBe('DZD');
  });

  it('turns empty numeric input into null', () => {
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull('12.5')).toBe(12.5);
    expect(numberOrNull(0)).toBe(0);
    expect(numberOrNull('abc')).toBeNull();
  });
});
