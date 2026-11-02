export type HealthResponse = { status: 'ok'; service: string; stage: string };
export type LayoutRun = { text: string; baseline_y_mm: number; source_range: [number, number]; kind: string };
export type LayoutResponse = { pages: Array<{ page_index: number; runs: LayoutRun[] }> };

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health');
  if (!response.ok) throw new Error('InkMatch backend is unavailable.');
  return response.json() as Promise<HealthResponse>;
}

export async function exportPdf(payload: Record<string, unknown>): Promise<Blob> {
  const response = await fetch('/api/v1/export/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('PDF export failed.');
  return response.blob();
}

export async function getLayout(payload: Record<string, unknown>): Promise<LayoutResponse> {
  const response = await fetch('/api/v1/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('Layout calculation failed.');
  return response.json() as Promise<LayoutResponse>;
}
