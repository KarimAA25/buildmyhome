import type { DesignSpecificationItem } from "@buildmyhome/shared";
import type { ImageDiffService } from "./ImageDiffService";

export class NoOpImageDiffProvider implements ImageDiffService {
  async detectItems(): Promise<DesignSpecificationItem[]> {
    return [];
  }
}
