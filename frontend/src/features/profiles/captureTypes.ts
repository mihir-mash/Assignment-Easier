import type { Prompt, PromptCategoryId } from "./prompts";
import type { StrokeData } from "./api";

export type CompletedCapture = {
  localId: string;
  serverId: string | null;
  promptId: string;
  prompt: Prompt;
  repetitionNumber: number;
  capturedAt: string;
  previewDataUrl: string;
  rawStrokeData: StrokeData;
  normalization: import("./api").Normalization | null;
  syncStatus: "saved" | "pending";
};

export type CaptureDraft = {
  version: 1;
  profileId: string;
  profileName: string;
  categoryId: PromptCategoryId;
  promptId: string;
  captureStartedAt: number;
  rawStrokeData: StrokeData;
  completedSamples: CompletedCapture[];
  skippedPromptIds: string[];
  penOnly: boolean;
  paused: boolean;
  finished: boolean;
};

export function emptyStrokeData(widthPx = 1, heightPx = 1): StrokeData {
  return {
    format_version: 2,
    strokes: [],
    events: [],
    pointer_type: "unknown",
    pen_metadata: {},
    canvas: { width_px: widthPx, height_px: heightPx },
  };
}
