export function PositionListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-xl border p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="bg-muted h-5 w-2/3 animate-pulse rounded" />
            <div className="bg-muted h-5 w-16 animate-pulse rounded" />
          </div>
          <div className="bg-muted mb-2 h-4 w-1/3 animate-pulse rounded" />
          <div className="bg-muted mb-1 h-3 w-full animate-pulse rounded" />
          <div className="bg-muted h-3 w-4/5 animate-pulse rounded" />
          <div className="mt-auto flex items-center justify-between pt-4">
            <div className="bg-muted h-3 w-24 animate-pulse rounded" />
            <div className="flex gap-1">
              <div className="bg-muted size-8 animate-pulse rounded" />
              <div className="bg-muted size-8 animate-pulse rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
