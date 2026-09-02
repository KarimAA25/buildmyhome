import type { DesignSpecificationItem } from "@buildmyhome/shared";
import type { CatalogProduct } from "../catalog/CatalogService";

export interface ImageDiffService {
  // Compares the before/after photos and returns every billable item
  // actually visible in the after photo, grounded against the catalog —
  // this is the source of truth for the quote, not the text design spec,
  // since an image-generation model doesn't perfectly follow instructions.
  detectItems(
    beforeImage: string,
    afterImage: string,
    catalog: CatalogProduct[]
  ): Promise<DesignSpecificationItem[]>;
}
