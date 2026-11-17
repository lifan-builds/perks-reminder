import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  );
}

// Card skeleton for loading credit cards
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border shadow-sm shadow-black/[0.03] p-4 shadow-md bg-card dark:border-border">
      {/* Card image placeholder */}
      <Skeleton className="h-40 w-full mb-4 rounded-lg" />
      
      {/* Title */}
      <Skeleton className="h-6 w-3/4 mb-2" />
      
      {/* Issuer info */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      
      {/* Benefits section */}
      <div className="mt-4 pt-3 border-t border-border">
        <Skeleton className="h-4 w-24 mb-2" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="mt-6 flex gap-2 pt-3 border-t border-border">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 flex-1 rounded-md" />
      </div>
    </div>
  );
}

// Cards page skeleton
export function CardsPageSkeleton() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
