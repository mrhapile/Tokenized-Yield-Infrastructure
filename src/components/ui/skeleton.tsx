"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardSkeleton className="lg:col-span-1" />
      <CardSkeleton className="lg:col-span-1" />
      <CardSkeleton className="lg:col-span-2" />
      <CardSkeleton className="lg:col-span-2" />
    </div>
  );
}
