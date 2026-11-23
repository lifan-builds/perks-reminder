import {
  BuildingOffice2Icon,
  CreditCardIcon,
  CubeIcon,
  FilmIcon,
  GiftIcon,
  PaperAirplaneIcon,
  ShoppingBagIcon,
  TruckIcon,
  BookOpenIcon,
  BriefcaseIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof CubeIcon> = {
  travel: PaperAirplaneIcon,
  airline: PaperAirplaneIcon,
  hotel: BuildingOffice2Icon,
  transportation: TruckIcon,
  rental_car: TruckIcon,
  dining: TicketIcon,
  'food delivery': TicketIcon,
  entertainment: FilmIcon,
  shopping: ShoppingBagIcon,
  business: BriefcaseIcon,
  'business services': BriefcaseIcon,
  credit_card: CreditCardIcon,
  general: BookOpenIcon,
  other: CubeIcon,
};

/** Drawn icon for a benefit category or loyalty program type; never an emoji. */
export default function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category.toLowerCase()] ?? GiftIcon;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden="true" />;
}
