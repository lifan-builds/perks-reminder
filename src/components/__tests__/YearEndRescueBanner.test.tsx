import { fireEvent, render, screen } from '@testing-library/react';
import YearEndRescueBanner, { summarizeYearEndRescue } from '@/components/YearEndRescueBanner';
import type { DisplayBenefitStatus } from '@/lib/benefit-dashboard-client';

const status = (overrides: Partial<DisplayBenefitStatus> & { maxAmount?: number }) => ({
  id: Math.random().toString(36),
  cycleEndDate: new Date('2026-12-31T23:59:59.999Z'),
  isCompleted: false,
  isNotUsable: false,
  usedAmount: 0,
  ...overrides,
  benefit: { maxAmount: overrides.maxAmount ?? 50 },
}) as unknown as DisplayBenefitStatus;

describe('summarizeYearEndRescue', () => {
  const now = new Date('2026-12-10T15:00:00Z');

  it('sums unclaimed value only for open credits closing at the Dec 31 deadline', () => {
    const summary = summarizeYearEndRescue([
      status({ maxAmount: 300 }),
      status({ maxAmount: 50, usedAmount: 20 }),
      status({ maxAmount: 100, isCompleted: true }),
      status({ maxAmount: 100, isNotUsable: true }),
      status({ maxAmount: 15, cycleEndDate: new Date('2027-01-31T23:59:59.999Z') }),
    ], now);
    expect(summary).toEqual({ year: 2026, count: 2, unclaimed: 330, chargeBy: '2026-12-27', daysToChargeBy: 17 });
  });

  it('stays quiet outside the Nov 1 - Dec 31 season and when nothing closes', () => {
    expect(summarizeYearEndRescue([status({})], new Date('2026-10-15T00:00:00Z'))).toBeNull();
    expect(summarizeYearEndRescue([status({ isCompleted: true })], now)).toBeNull();
  });
});

describe('YearEndRescueBanner', () => {
  it('states the amount, the charge-by date, and toggles the rescue view', () => {
    const onToggle = jest.fn();
    render(
      <YearEndRescueBanner
        summary={{ year: 2026, count: 2, unclaimed: 330, chargeBy: '2026-12-27', daysToChargeBy: 3 }}
        rescueOnly={false}
        onToggle={onToggle}
      />
    );
    expect(screen.getByRole('heading', { name: '$330 closes on Dec 31' })).toBeInTheDocument();
    expect(screen.getByText('Dec 27')).toHaveAttribute('datetime', '2026-12-27');
    fireEvent.click(screen.getByRole('button', { name: 'Show only these' }));
    expect(onToggle).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Rescue guide' })).toHaveAttribute('href', '/expiring');
  });
});
