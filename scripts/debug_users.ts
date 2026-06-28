import { createSupabaseAdminClient } from "../src/lib/supabaseAdmin";

async function main() {
  const admin = createSupabaseAdminClient();

  // 1. Fetch platform users
  const { data: platformUsers, error: pError } = await admin
    .from("platform_users")
    .select("*");

  console.log("=== platform_users ===");
  if (pError) console.error("Error platform_users:", pError.message);
  else console.log(platformUsers);

  // 2. Fetch auth users
  const { data: authUsers, error: aError } = await admin.auth.admin.listUsers();
  console.log("\n=== auth.users ===");
  if (aError) console.error("Error auth.users:", aError.message);
  else {
    console.log(authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.app_metadata?.role,
      metadata: u.app_metadata
    })));
  }
}

main().catch(console.error);
