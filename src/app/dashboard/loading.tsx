export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-4 w-32 rounded bg-[#e6e8eb]" />
        <div className="mt-3 h-9 w-72 rounded bg-[#e6e8eb]" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-[#e6e8eb]" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-md border border-[#e6e8eb] bg-white" />
        ))}
      </div>
      <div className="h-64 rounded-md border border-[#e6e8eb] bg-white" />
    </div>
  );
}
