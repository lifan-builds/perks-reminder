import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { PublicStaticCard } from '@/lib/static-catalog';
import { buildCycleLedger, yearPosition } from '@/lib/cycle-ledger';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

interface CycleLedgerProps {
  card: PublicStaticCard;
  now: Date;
  rows?: number;
  className?: string;
}

/**
 * One card's calendar credits drawn as a validity record across the year, with
 * a single needle for today. Windows that are open now are inked; windows that
 * close within the current month or next are stamped in vermilion.
 */
export default function CycleLedger({ card, now, rows = 6, className }: CycleLedgerProps) {
  const ledger = buildCycleLedger(card, rows);
  const position = yearPosition(now);
  const month = now.getUTCMonth() + 1;
  const todayLabel = `${now.getUTCDate()} ${MONTH_NAMES[now.getUTCMonth()]}`;

  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="flex items-center gap-3">
        {card.imageUrl && (
          <Image src={card.imageUrl} alt="" width={64} height={40} className="h-10 w-16 rounded-[4px] object-cover shadow-sm shadow-black/25" />
        )}
        <div className="min-w-0">
          <p className="field-label">Validity record · {now.getUTCFullYear()}</p>
          <p className="truncate text-sm font-semibold text-foreground">{card.name}</p>
        </div>
      </figcaption>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
        <div className="hidden sm:block" aria-hidden="true" />
        <div className="relative col-span-2 grid grid-cols-12 text-center text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground sm:col-span-1" aria-hidden="true">
          {MONTHS.map((label, index) => (
            <span key={index} className={cn(index + 1 === month && 'text-foreground')}>{label}</span>
          ))}
        </div>
        <div className="hidden w-14 sm:block" aria-hidden="true" />

        <div className="relative col-span-2 sm:col-span-3">
          <ul className="mt-2 divide-y divide-border/70" aria-label={`${card.name} calendar credits`}>
            {ledger.map((row) => {
              const open = row.windows.find((window) => window.start <= month && month <= window.end);
              const closingSoon = open && open.end - month <= 1;
              return (
                <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
                  <div className="min-w-0 sm:pr-2">
                    <p className="truncate text-[0.8125rem] font-medium leading-5 text-foreground" title={row.label}>{row.label.replace(/^\$[\d,.]+\s+/, '')}</p>
                    <p className="text-[0.6875rem] leading-4 text-muted-foreground">{row.cadence}</p>
                  </div>
                  <p className="font-display text-base leading-none text-foreground tabular sm:order-last sm:w-14 sm:text-right">{money(row.annual)}</p>
                  <div className="relative col-span-2 grid h-4 grid-cols-12 gap-[3px] sm:col-span-1" role="img" aria-label={`${row.cadence}${open ? `; current window ends ${MONTH_NAMES[open.end - 1]}` : ''}`}>
                    {row.windows.map((window) => {
                      const isOpen = window === open;
                      const isPast = window.end < month;
                      return (
                        <span
                          key={`${window.start}-${window.end}`}
                          style={{ gridColumn: `${window.start} / ${window.end + 1}` }}
                          className={cn(
                            'rounded-[3px] border',
                            isOpen
                              ? closingSoon
                                ? 'border-stamp bg-stamp'
                                : 'border-primary bg-primary'
                              : isPast
                                ? 'border-border bg-muted'
                                : 'border-primary/35 bg-transparent'
                          )}
                        />
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className="pointer-events-none absolute inset-y-0 left-0 right-0 grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3.5rem] sm:gap-x-4"
            aria-hidden="true"
          >
            <div className="hidden sm:block" />
            <div className="relative">
              <span className="absolute -top-1 bottom-0 w-px bg-stamp" style={{ left: `${(position / 12) * 100}%` }} />
              <span
                className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap rounded-full bg-stamp px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.12em] text-stamp-foreground"
                style={{ left: `${(position / 12) * 100}%` }}
              >
                TODAY · {todayLabel.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
