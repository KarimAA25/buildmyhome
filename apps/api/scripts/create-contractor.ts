import { parseArgs } from "node:util";
import { customAlphabet } from "nanoid";
import { supabase } from "../src/services/supabaseClient";

// URL-safe, unguessable, 24+ chars per CLAUDE2 §2a/§8.
const generateToken = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 32);

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      website: { type: "string" },
    },
  });

  if (!values.name || !values.email) {
    console.error(
      "Usage: tsx scripts/create-contractor.ts --name \"Acme Kitchens\" --email contact@acme.com [--phone 555-1234] [--website https://acme.com]"
    );
    process.exit(1);
  }

  const contractorToken = generateToken();

  const { data, error } = await supabase
    .from("contractors")
    .insert({
      name: values.name,
      contact_email: values.email,
      phone: values.phone ?? null,
      website_url: values.website ?? null,
      contractor_token: contractorToken,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create contractor:", error.message);
    process.exit(1);
  }

  console.log(`Created contractor "${data.name}" (id: ${data.id})`);
  console.log(`\nCONTRACTOR_TOKEN=${data.contractor_token}`);
  console.log("\nCopy this into that contractor's apps/web deployment env vars (never NEXT_PUBLIC_-prefixed).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
