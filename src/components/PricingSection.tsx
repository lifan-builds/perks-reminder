import Link from 'next/link';
import InkStamp from '@/components/art/InkStamp';

const schedule = [
  ['Annual fee', 'Per account, every year'],
  ['Cards tracked', 'Unlimited physical cards, including duplicates'],
  ['Benefit Cycles', 'Monthly, quarterly, half-year, anniversary, multi-year'],
  ['Email reminders', 'Custom reminder windows before each reset'],
  ['Benefit Usage Guides', 'Every guide, every card'],
  ['Loyalty expirations', 'Points, miles, and free-night certificates'],
  ['Annual-fee ROI', 'Claimed value against fees, per card'],
  ['Import and export', 'Full JSON and CSV, any time'],
];

interface PricingSectionProps {
  headingLevel?: 'h1' | 'h2';
}

export default function PricingSection({ headingLevel = 'h2' }: PricingSectionProps) {
  const Heading = headingLevel;

  return (
    <section id="pricing" className="border-b border-border py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:px-8">
        <div>
          <Heading className="font-display text-5xl leading-[1.03] text-foreground sm:text-6xl">
            Completely free
          </Heading>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Perks Reminder has no paid plan, no subscription, and no card or reminder limit. It is open source and never
            asks for a bank login.
          </p>
          <Link
            href="/auth/signup"
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm shadow-black/10 transition-colors hover:bg-primary/90 sm:w-auto"
          >
            Create free account
          </Link>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            If abuse prevention ever needs limits, they will be operational safeguards, not paid feature gates.
          </p>
        </div>

        <div className="document-frame relative rounded-xl p-5 sm:p-8">
          <InkStamp
            rim="PAID IN FULL"
            center="$0"
            caption="FOREVER"
            tone="visa"
            rotate={12}
            className="absolute -right-3 -top-6 h-28 w-28 sm:-right-6 sm:h-32 sm:w-32"
          />
          <table className="w-full text-left">
            <caption className="font-display pb-4 text-left text-2xl text-foreground">Fee schedule</caption>
            <thead>
              <tr className="border-b border-foreground/70">
                <th scope="col" className="field-label py-2 pr-4">Item</th>
                <th scope="col" className="field-label hidden py-2 pr-4 sm:table-cell">Covers</th>
                <th scope="col" className="field-label py-2 text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedule.map(([item, covers]) => (
                <tr key={item}>
                  <th scope="row" className="py-3 pr-4 align-top text-sm font-semibold text-foreground">
                    {item}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground sm:hidden">{covers}</span>
                  </th>
                  <td className="hidden py-3 pr-4 align-top text-sm text-muted-foreground sm:table-cell">{covers}</td>
                  <td className="font-display py-3 text-right align-top text-xl text-foreground tabular">$0</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/70">
                <th scope="row" className="pt-4 text-sm font-semibold text-foreground" colSpan={1}>Total due</th>
                <td className="hidden sm:table-cell" />
                <td className="font-display pt-4 text-right text-3xl text-foreground tabular">$0</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
