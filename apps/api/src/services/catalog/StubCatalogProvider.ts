import type { CatalogProduct, CatalogService } from "./CatalogService";

export class StubCatalogProvider implements CatalogService {
  async getAll(): Promise<CatalogProduct[]> {
    return [];
  }

  async getById(_id: string): Promise<CatalogProduct | null> {
    return null;
  }
}
