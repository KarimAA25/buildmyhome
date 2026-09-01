import type { ProgressState } from "@buildmyhome/shared";

export const PROGRESS_LABELS: Record<ProgressState, string> = {
  ANALYZING: "Analyzing your room...",
  SEARCHING_PRODUCTS: "Searching products...",
  CREATING_DESIGN: "Creating design...",
  CALCULATING_QUOTE: "Calculating quote...",
  GENERATING_IMAGE: "Generating image...",
  VALIDATING: "Validating result...",
  COMPLETED: "Finishing up...",
  FAILED: "Something went wrong",
};
