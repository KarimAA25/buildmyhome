import type { ProgressState } from "@buildmyhome/shared";

export const PROGRESS_LABELS: Record<ProgressState, string> = {
  ANALYZING: "Analyzing your room...",
  SEARCHING_PRODUCTS: "Searching products...",
  CREATING_DESIGN: "Creating design...",
  GENERATING_IMAGE: "Generating image...",
  VALIDATING: "Validating result...",
  REVIEWING_RESULT: "Reviewing the result...",
  CALCULATING_QUOTE: "Calculating quote...",
  COMPLETED: "Finishing up...",
  FAILED: "Something went wrong",
};
