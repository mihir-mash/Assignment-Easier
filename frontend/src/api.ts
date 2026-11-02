import type { Settings, Layout } from "../../shared/layout";
export type Corners = [number, number][];
export type Detection = {
  corners: Corners;
  confidence: string;
  message: string;
};
export type Suggestions = {
  baseline_ys_mm: number[];
  line_spacing_mm: number | null;
  left_margin_mm: number;
  right_margin_mm: number;
  message: string;
};

async function request<T>(path: string, payload?: object): Promise<T> {
  const response = await fetch(
    `/api/v1/${path}`,
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        }
      : { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body ? body.detail : null;
    throw new Error(
      typeof detail === "string"
        ? detail
        : "Request failed. Check the image and settings, then try again.",
    );
  }
  return response.json() as Promise<T>;
}
export const getHealth = () => request<{ status: string }>("health");
export const getLayout = (source_text: string, settings: Settings) =>
  request<Layout>("layout", { source_text, ...settings });
export const detectPaper = (image: string) =>
  request<Detection>("paper/detect", { image });
export const cropPaper = (
  image: string,
  corners: Corners,
  width_mm: number,
  height_mm: number,
) =>
  request<{ image: string }>("paper/crop", {
    image,
    corners,
    width_mm,
    height_mm,
  });
export const suggestLines = (
  image: string,
  width_mm: number,
  height_mm: number,
) => request<Suggestions>("paper/lines", { image, width_mm, height_mm });
export async function exportPdf(
  source_text: string,
  settings: Settings,
): Promise<Blob> {
  const response = await fetch("/api/v1/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_text, ...settings }),
  });
  if (!response.ok)
    throw new Error(
      "PDF export failed. Check settings and start the local backend.",
    );
  return response.blob();
}
