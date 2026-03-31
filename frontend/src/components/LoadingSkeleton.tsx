interface LoadingSkeletonProps {
  rows?: number;
  type?: 'table' | 'card' | 'text';
}

export default function LoadingSkeleton({ rows = 5, type = 'table' }: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-gray-200" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-pulse">
      <div className="mb-4 h-10 rounded bg-gray-200" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-3 h-12 rounded bg-gray-100" />
      ))}
    </div>
  );
}
