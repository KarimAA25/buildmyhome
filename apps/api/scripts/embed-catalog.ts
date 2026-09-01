import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CatalogFileSchema } from "../src/services/catalog/CatalogService";
import { services } from "../src/container";

const CATALOG_PATH = path.join(__dirname, "../data/catalog.json");

async function main() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
  const parsed = CatalogFileSchema.parse(raw);

  let embeddedCount = 0;
  const products = await Promise.all(
    parsed.products.map(async (product) => {
      if (product.embedding) return product;
      embeddedCount += 1;
      return {
        ...product,
        embedding: await services.embedding.embed(`${product.name} — ${product.description ?? product.category}`),
      };
    })
  );

  writeFileSync(CATALOG_PATH, JSON.stringify({ ...parsed, products }, null, 2) + "\n");
  console.log(`Embedded ${embeddedCount} of ${products.length} product(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
