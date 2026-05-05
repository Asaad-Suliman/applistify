import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LimitReachedBanner from "@/components/optimize/LimitReachedBanner";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("runs_used")
    .eq("id", user.id)
    .single();

  const { data: recentOptimizations } = await supabase
    .from("optimizations")
    .select("id, app_name, platform, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const runsUsed = profile?.runs_used ?? 0;
  const atLimit = runsUsed >= 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back, {user.email}</p>
      </div>

      {atLimit && <LimitReachedBanner />}

      {!atLimit && (
        <Link
          href="/optimize"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          + New Optimization
        </Link>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Recent Optimizations
        </h2>
        {!recentOptimizations || recentOptimizations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            No optimizations yet.{" "}
            {!atLimit && (
              <Link
                href="/optimize"
                className="text-indigo-500 hover:underline"
              >
                Create your first one.
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {recentOptimizations.map((opt) => (
              <li key={opt.id}>
                <Link
                  href={`/result/${opt.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-indigo-300 transition"
                >
                  <div>
                    <p className="font-medium text-gray-900">{opt.app_name}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {opt.platform} ·{" "}
                      {new Date(opt.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs text-indigo-500">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
