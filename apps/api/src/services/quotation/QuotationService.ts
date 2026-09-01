import type { DesignSpecification, Quote } from "@buildmyhome/shared";
import type { CatalogProduct } from "../catalog/CatalogService";

export interface QuotationService {
  calculate(spec: DesignSpecification, catalog: CatalogProduct[]): Quote;
}
