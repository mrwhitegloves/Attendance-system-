import { describe, expect, it } from 'vitest';
import { resolveDateRange } from '@/lib/dateRanges.js';
import { momentCondition } from '@/server/lib/dateFilter.js';

// Today is Wednesday 28 October 2026 (India).
const TODAY = '2026-10-28';
const range = (name, extra = {}) => resolveDateRange({ range: name, ...extra }, TODAY);

describe('date filter choices', () => {
  it.each([
    ['today', '2026-10-28', '2026-10-28'],
    ['yesterday', '2026-10-27', '2026-10-27'],
    ['last7', '2026-10-22', '2026-10-28'],
    ['last30', '2026-09-29', '2026-10-28'],
    ['last90', '2026-07-31', '2026-10-28'],
    ['thisWeek', '2026-10-26', '2026-11-01'],
    ['thisMonth', '2026-10-01', '2026-10-31'],
    ['lastMonth', '2026-09-01', '2026-09-30'],
    ['thisQuarter', '2026-10-01', '2026-12-31'],
    ['lastQuarter', '2026-07-01', '2026-09-30'],
    ['thisFinancialYear', '2026-04-01', '2027-03-31'],
    ['lastFinancialYear', '2025-04-01', '2026-03-31'],
  ])('%s → %s to %s', (name, from, to) => {
    expect(range(name)).toEqual({ from, to });
  });

  it('any time is no filter; a custom range keeps its days (in order)', () => {
    expect(range('')).toBeNull();
    expect(range('custom', { from: '2026-10-10', to: '2026-10-01' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-10',
    });
    expect(resolveDateRange({ from: '2026-10-05' }, TODAY)).toEqual({
      from: '2026-10-05',
      to: null,
    });
  });

  it('in January the financial year started last April', () => {
    expect(resolveDateRange({ range: 'thisFinancialYear' }, '2027-01-15')).toEqual({
      from: '2026-04-01',
      to: '2027-03-31',
    });
  });

  it('a day starts at midnight India time for moments', () => {
    const condition = momentCondition({ range: 'today' }, new Date('2026-10-28T10:00:00+05:30'));
    expect(condition.$gte.toISOString()).toBe('2026-10-27T18:30:00.000Z');
    expect(condition.$lte.toISOString()).toBe('2026-10-28T18:29:59.999Z');
  });
});
