import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { AppShellClient } from "@/components/layout/app-shell-client";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppShellClient userEmail={user.email}>{children}</AppShellClient>
      </div>
    </div>
  );
}
