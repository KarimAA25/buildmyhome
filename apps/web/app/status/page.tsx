import { getHealth } from "@/lib/apiClient";

export default async function StatusPage() {
  const health = await getHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">System Status</h1>
      <p className="text-sm text-neutral-500">
        API status: <span className="font-mono">{health.status}</span> ({health.timestamp})
      </p>
    </main>
  );
}
