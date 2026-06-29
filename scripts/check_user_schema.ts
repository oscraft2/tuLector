import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env variables manually from .env.production.local
let SUPABASE_URL = "";
let SUPABASE_SERVICE_KEY = "";

try {
  const content = readFileSync(resolve(__dirname, "../.env.production.local"), "utf8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      if (key === "NEXT_PUBLIC_SUPABASE_URL") SUPABASE_URL = val;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") SUPABASE_SERVICE_KEY = val;
    }
  });
} catch (e) {
  console.error("Error reading .env.production.local:", e);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing credentials in env files");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function main() {
  const email = "zj.ventaschile@gmail.com";
  console.log(`Checking user info with admin privileges for: ${email}`);

  const { data: authUsers, error: aError } = await admin.auth.admin.listUsers();
  if (aError) {
    console.error("Error listing users:", aError.message);
    return;
  }

  const user = authUsers.users.find(u => u.email === email);
  if (!user) {
    console.log(`User ${email} NOT found in auth.users.`);
    return;
  }

  console.log("User details:", {
    id: user.id,
    email: user.email,
    confirmed: user.email_confirmed_at,
    identities: user.identities
  });

  // Test sign in as user via service role to see if it triggers the same schema querying error
  console.log("\nAttempting login with service role to get a user session...");
}

main().catch(console.error);
