import { ApiError } from "../../api";
import type { Prompt } from "./prompts";

export type PointerType = "pen" | "mouse" | "touch" | "unknown";
export type StrokePoint = {
  x: number;
  y: number;
  timestamp: number;
  pressure: number | null;
  tiltX: number | null;
  tiltY: number | null;
  pointer_type: PointerType;
};
export type StrokeEvent = {
  type:
    | "pen_down"
    | "pen_up"
    | "pointer_cancel"
    | "lost_pointer_capture"
    | "session_interrupted";
  timestamp: number;
  stroke_index: number;
};
export type Stroke = {
  points: StrokePoint[];
  pointer_type: PointerType;
  start_timestamp: number;
  end_timestamp: number | null;
  interrupted: boolean;
};
export type StrokeData = {
  format_version: 2;
  strokes: Stroke[];
  events: StrokeEvent[];
  pointer_type: PointerType;
  pen_metadata: Record<string, unknown>;
  canvas: { width_px: number; height_px: number };
};
export type Normalization = {
  format_version: number;
  source_format_version: number;
  canvas: { width_px: number; height_px: number };
  bounding_box: { min_x: number; min_y: number; max_x: number; max_y: number };
  stroke_count: number;
  duration_ms: number;
  has_pressure: boolean;
  has_timing: boolean;
  interrupted_stroke_count: number;
  strokes: Stroke[];
  quality: { problems: { code: string; message: string }[]; can_keep: true };
};
export type Profile = {
  id: string;
  name: string;
  status: string;
  sample_sources: string[];
  total_sample_count: number;
};
export type ProfileSampleSummary = {
  id: string;
  profile_id: string;
  prompt_text: string | null;
  label_type: Prompt["labelType"] | "unlabelled";
  label_text: string | null;
  context: Prompt["context"];
  repetition_number: number | null;
  label_alignment: "exact" | "unaligned" | "manual" | "unknown";
};
export type SampleCreatePayload = {
  source_type: "stylus";
  prompt_text: string;
  label_type: Prompt["labelType"];
  label_text: string;
  context: Prompt["context"];
  repetition_number: number;
  label_alignment: "exact" | "unaligned";
  dimensions: { width_px: number; height_px: number };
  processing_status: string;
  quality_indicators: Record<string, unknown>;
  stroke_data: StrokeData;
};

async function apiRequest<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method: payload === undefined ? "GET" : "POST",
    headers:
      payload === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new ApiError(
      typeof detail === "string"
        ? detail
        : "The local profile service could not complete this request.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export const createProfile = (name: string) =>
  apiRequest<Profile>("profiles", {
    name,
    status: "Collecting Samples",
    sample_sources: ["stylus"],
  });

export const getProfile = (profileId: string) =>
  apiRequest<Profile>(`profiles/${encodeURIComponent(profileId)}`);

export const listProfileSamples = (profileId: string) =>
  apiRequest<ProfileSampleSummary[]>(
    `profiles/${encodeURIComponent(profileId)}/samples`,
  );

export const normalizeStrokeData = (strokeData: StrokeData) =>
  apiRequest<Normalization>("profiles/normalize", { stroke_data: strokeData });

export const createProfileSample = (
  profileId: string,
  payload: SampleCreatePayload,
) =>
  apiRequest<{ id: string; normalization?: Normalization }>(
    `profiles/${encodeURIComponent(profileId)}/samples`,
    payload,
  );
