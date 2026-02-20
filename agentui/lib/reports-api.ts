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

export async function uploadReport(file: File): Promise<ReportFile> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch(`${API_URL}/api/reports/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed: ${detail}`);
  }
  return res.json();
}

export async function deleteReportApi(filename: string): Promise<void> {
  const res = await authFetch(
    `${API_URL}/api/reports/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to delete report: ${res.status}`);
}

export async function downloadReport(path: string, filename: string) {
  const res = await authFetch(
    `${API_URL}/api/reports/download?path=${encodeURIComponent(path)}`
  );
  if (!res.ok) throw new Error(`Failed to download report: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
