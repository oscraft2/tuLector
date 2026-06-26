export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#fafafa] p-8 text-[#0b1220]">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-10 w-64 rounded bg-[#e6e8eb]" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-md bg-[#e6e8eb]" />)}</div>
        <div className="h-96 rounded-md bg-[#e6e8eb]" />
      </div>
    </main>
  );
}
