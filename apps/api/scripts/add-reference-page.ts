import { parseArgs } from "node:util";
import { supabase } from "../src/services/supabaseClient";

async function resolveContractorId(identifier: string): Promise<string> {
  // Accept either a contractor_token or a raw contractor id — whichever was
  // handy for whoever's running this script.
  const byToken = await supabase.from("contractors").select("id").eq("contractor_token", identifier).maybeSingle();
  if (byToken.data) return byToken.data.id;

  const byId = await supabase.from("contractors").select("id").eq("id", identifier).maybeSingle();
  if (byId.data) return byId.data.id;

  throw new Error(`No contractor found matching token or id "${identifier}"`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      contractor: { type: "string" },
      url: { type: "string" },
      label: { type: "string" },
    },
  });

  if (!values.contractor || !values.url) {
    console.error(
      'Usage: tsx scripts/add-reference-page.ts --contractor <token-or-id> --url "https://contractor.com/products/kitchen-cabinets" [--label "Kitchen cabinets"]'
    );
    process.exit(1);
  }

  const contractorId = await resolveContractorId(values.contractor);

  const { data, error } = await supabase
    .from("contractor_reference_pages")
    .insert({ contractor_id: contractorId, url: values.url, label: values.label ?? null })
    .select()
    .single();

  if (error) {
    console.error("Failed to add reference page:", error.message);
    process.exit(1);
  }

  console.log(`Added reference page ${data.url} (id: ${data.id}) for contractor ${contractorId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
