import { API_URL } from "@/lib/config";
import { authFetch } from "@/lib/auth";

export interface ReportFile {
  name: string;
  path: string;
  type: string;
  sizeBytes: number;
  modifiedAt: string;
}

export async function fetchReports(): Promise<ReportFile[]> {
  const res = await authFetch(`${API_URL}/api/reports`);
  if (!res.ok) throw new Error(`Failed to fetch reports: ${res.status}`);
  const data = await res.json();
  return data.files ?? [];
}

export async function fetchReportContent(
  path: string
): Promise<{ content: string; language: string; encoding?: string }> {
  const res = await authFetch(
    `${API_URL}/api/fetch_file?path=${encodeURIComponent(path)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch report content: ${res.status}`);
  return res.json();
}
