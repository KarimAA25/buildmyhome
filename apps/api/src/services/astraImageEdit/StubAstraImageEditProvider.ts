import type { DesignSpecification } from "@buildmyhome/shared";
import type { AstraEditModel, AstraImageEditService } from "./AstraImageEditService";

export class StubAstraImageEditProvider implements AstraImageEditService {
  async edit(
    currentImage: string,
    _designSpecification: DesignSpecification,
    _editInstruction: string,
    _model: AstraEditModel
  ): Promise<string> {
    return currentImage;
  }
}
