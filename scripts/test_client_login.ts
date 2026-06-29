import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env variables manually from .env.production.local
let SUPABASE_URL = "";
let SUPABASE_ANON_KEY = "";

try {
  const content = readFileSync(resolve(__dirname, "../.env.production.local"), "utf8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || "";
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      if (key === "NEXT_PUBLIC_SUPABASE_URL") SUPABASE_URL = val;
      if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") SUPABASE_ANON_KEY = val;
    }
  });
} catch (e) {
  console.error("Error reading .env.production.local:", e);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing credentials in env files");
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const email = "zj.ventaschile@gmail.com";
  const password = "zj.ventaschile@gmail.com"; // Let's check both or whatever the password is
  const passTry = "221290";

  console.log(`Attempting login for: ${email}`);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: passTry
  });

  if (error) {
    console.error("Login failed:", error.message);
    return;
  }

  console.log("Login successful! User ID:", data.user?.id);
  console.log("Session:", data.session ? "Active" : "None");

  // Check schools & school_members
  const { data: members, error: mErr } = await client.from("school_members").select("*");
  console.log("School memberships for logged-in user:", members, mErr?.message);

  if (members && members.length > 0) {
    const { data: schools, error: sErr } = await client.from("schools").select("*");
    console.log("Schools details:", schools, sErr?.message);
  }
}

main().catch(console.error);
