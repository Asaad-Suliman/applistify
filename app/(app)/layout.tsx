import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RunCounter from "@/components/optimize/RunCounter";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-indigo-600">AppListify</span>
        <div className="flex items-center gap-4">
          <RunCounter runsUsed={profile?.runs_used ?? 0} />
          <LogoutButton />
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
