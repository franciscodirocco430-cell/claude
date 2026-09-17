import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and creator profile.
        </p>
      </div>
      <SettingsForm email={user?.email ?? ""} profile={profile ?? null} />
    </div>
  );
}
