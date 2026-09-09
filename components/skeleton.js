export function AppSkeleton() {
  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex bg-slate-900 dark:bg-slate-950 w-60 shrink-0 flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="skeleton h-8 w-32" style={{ backgroundColor: "#1e293b" }} />
        </div>
        <div className="flex-1 py-3 px-2 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full" style={{ backgroundColor: "#1e293b" }} />
          ))}
        </div>
      </div>

      {/* Main skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="flex-1 p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="skeleton h-9 w-9 rounded-lg mb-3" />
                <div className="skeleton h-6 w-12 mb-2" />
                <div className="skeleton h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="skeleton h-4 w-40 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-1/3" />
                    <div className="skeleton h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="skeleton h-3 w-full max-w-xs" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <div className="skeleton h-3 flex-1 max-w-[160px]" />
            <div className="skeleton h-3 flex-1 max-w-[100px]" />
            <div className="skeleton h-3 flex-1 max-w-[100px]" />
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
