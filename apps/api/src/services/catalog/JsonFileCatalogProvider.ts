import { readFileSync } from "node:fs";
import path from "node:path";
import { CatalogFileSchema, type CatalogProduct, type CatalogService } from "./CatalogService";

const CATALOG_PATH = path.join(__dirname, "../../../data/catalog.json");

export class JsonFileCatalogProvider implements CatalogService {
  private products: CatalogProduct[];

  constructor() {
    const raw = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
    const parsed = CatalogFileSchema.parse(raw);

    if (parsed._meta?.isSampleData) {
      console.warn(
        `[catalog] Loaded ${parsed.products.length} SAMPLE/PLACEHOLDER product(s) — not real pricing data.` +
          (parsed._meta.warning ? ` ${parsed._meta.warning}` : "")
      );
    }

    this.products = parsed.products;
  }

  async getAll(): Promise<CatalogProduct[]> {
    return this.products;
  }

  async getById(id: string): Promise<CatalogProduct | null> {
    return this.products.find((product) => product.id === id) ?? null;
  }
}
