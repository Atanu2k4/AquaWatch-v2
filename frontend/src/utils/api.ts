// src/utils/api.ts
// Typed service layer for the AquaWatch FastAPI backend (localhost:8000)

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = import.meta.env.VITE_BACKEND_API_KEY ?? "dev-local-key";

export const getFullImageUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }
  if (url.startsWith('http://localhost:8000')) {
    return url.replace('http://localhost:8000', BASE_URL);
  }
  return url;
};

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as any)?.detail ?? res.statusText;
    throw new Error(detail);
  }
  return data as T;
}

// ── Data endpoints (require API key) ────────────────────────────────────────

export const getTodayData = () =>
  request<{ date: string; records_by_state: Record<string, any> }>(
    "GET",
    `/today-data?api_key=${API_KEY}`
  );

export const getStateData = (state: string) =>
  request<{ state: string; records: Record<string, any> }>(
    "GET",
    `/state-data?state=${encodeURIComponent(state)}&api_key=${API_KEY}`
  );

export const getMongoState = (state: string) =>
  request<{ state: string; last5: any[] }>(
    "GET",
    `/mongo-state?state=${encodeURIComponent(state)}&api_key=${API_KEY}`
  );

export const triggerSync = () =>
  request<{ message: string }>("POST", `/sync?api_key=${API_KEY}`);

// ── Auth endpoints ───────────────────────────────────────────────────────────

export interface AdminLoginResponse {
  ok: boolean;
  role: "admin";
  id: string;
}

export const adminLogin = (id: string, password: string) =>
  request<AdminLoginResponse>("POST", "/admin/login", { id, password });

export interface SuperAdminLoginResponse {
  ok: boolean;
  role: "superadmin";
  id: string;
}

export const superAdminLogin = (id: string, password: string) =>
  request<SuperAdminLoginResponse>("POST", "/superadmin/login", {
    id,
    password,
  });

// ── L1 Authority endpoints ───────────────────────────────────────────────────

export interface L1RegisterPayload {
  govt_id: string;
  name: string;
  password: string;
  state: string;
  district: string;
}

export interface L1RegisterResponse {
  message: string;
  status: string;
}

export const registerL1 = (payload: L1RegisterPayload) =>
  request<L1RegisterResponse>("POST", "/l1-authority/register", payload);

export interface L1Profile {
  govt_id: string;
  name: string;
  assigned_location: { state: string; district: string };
  status: string;
}

export const getL1Profile = (govtId: string) =>
  request<L1Profile>("GET", `/l1-authority/${encodeURIComponent(govtId)}`);

export const approveL1 = (
  govtId: string,
  adminId: string,
  adminPassword: string
) =>
  request<{ message: string; status: string }>(
    "POST",
    `/l1-authority/${govtId}/approve?admin_id=${encodeURIComponent(
      adminId
    )}&admin_password=${encodeURIComponent(adminPassword)}`
  );

export interface PendingL1 {
  _id: string;
  govt_id: string;
  name: string;
  assigned_location: { state: string; district: string };
  status: string;
  created_at: string;
}

export const getPendingL1 = (adminId: string, adminPassword: string) =>
  request<{ pending: PendingL1[] }>(
    "GET",
    `/admin/${encodeURIComponent(adminId)}/pending-l1?admin_password=${encodeURIComponent(adminPassword)}`
  );

export const getAllL1 = (adminId: string, adminPassword: string) =>
  request<{ authorities: PendingL1[] }>(
    "GET",
    `/admin/${encodeURIComponent(adminId)}/all-l1?admin_password=${encodeURIComponent(adminPassword)}`
  );

export const updateL1Status = (adminId: string, govtId: string, adminPassword: string, status: string) =>
  request<{ message: string; status: string }>(
    "POST",
    `/admin/${encodeURIComponent(adminId)}/l1-status/${encodeURIComponent(govtId)}?admin_password=${encodeURIComponent(adminPassword)}`,
    { status }
  );

export const updateReportStatusL1 = (
  govtId: string,
  reportId: string,
  idToken: string,
  status: "verified" | "rejected" | "escalated",
  note?: string
) =>
  request<{ message: string; status: string }>(
    "POST",
    `/l1/${encodeURIComponent(govtId)}/reports/${encodeURIComponent(reportId)}/status`,
    { id_token: idToken, status, note }
  );

export const updateReportStatusAdmin = (
  adminId: string,
  adminPassword: string,
  reportId: string,
  status: "assigned" | "resolved",
  departments?: string[],
  note?: string
) =>
  request<{ message: string; status: string }>(
    "POST",
    `/admin/${encodeURIComponent(adminId)}/reports/${encodeURIComponent(reportId)}/status`,
    { admin_password: adminPassword, status, departments, note }
  );

export interface IncidentReportResponse {
  id: string;
  imageUrl: string;
  location: { lat: number | null; lng: number | null; state: string; district: string };
  description: string;
  aiAnalysis: { summary: string; hazardType?: string; severity?: string; confidence?: number } | null;
  sensorReading: number;
  sensorCategory: string;
  sensorBasedOnDays: number;
  status: string;
  citizenSessionId: string;
  createdAt: string;
}

export const submitIncidentReport = async (formData: FormData) => {
  const res = await fetch(`${BASE_URL}/incident-reports`, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.detail ?? res.statusText);
  return data as IncidentReportResponse;
};

export interface UploadCsvResponse {
  message: string;
  rows_written: number;
  skipped_other_state: number;
}

export const uploadStateCsv = async (adminId: string, adminPassword: string, file: File) => {
  const formData = new FormData();
  formData.append("admin_password", adminPassword);
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/admin/${encodeURIComponent(adminId)}/upload-csv`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.detail ?? res.statusText);
  return data as UploadCsvResponse;
};

// ── SME / Authority endpoints ─────────────────────────────────────────────────

export interface SMERegisterPayload {
  sme_id: string;
  name: string;
  password: string;
  state: string;
  department: string;
}

export const registerSME = (payload: SMERegisterPayload) =>
  request<{ message: string; status: string }>("POST", "/sme-authority/register", payload);

export interface SMEProfile {
  sme_id: string;
  name: string;
  state: string;
  department: string;
  status: string;
}

export const getSMEProfile = (smeId: string) =>
  request<SMEProfile>("GET", `/sme-authority/${encodeURIComponent(smeId)}`);

export const approveSME = (smeId: string, adminId: string, adminPassword: string) =>
  request<{ message: string; status: string }>(
    "POST",
    `/sme-authority/${smeId}/approve?admin_id=${encodeURIComponent(adminId)}&admin_password=${encodeURIComponent(adminPassword)}`
  );

export const getPendingSME = (adminId: string, adminPassword: string) =>
  request<{ pending: SMEProfile[] }>(
    "GET",
    `/admin/${encodeURIComponent(adminId)}/pending-sme?admin_password=${encodeURIComponent(adminPassword)}`
  );

export const getAllSME = (adminId: string, adminPassword: string) =>
  request<{ authorities: SMEProfile[] }>(
    "GET",
    `/admin/${encodeURIComponent(adminId)}/all-sme?admin_password=${encodeURIComponent(adminPassword)}`
  );

export const updateSMEStatus = (adminId: string, smeId: string, adminPassword: string, status: string) =>
  request<{ message: string; status: string }>(
    "POST",
    `/admin/${encodeURIComponent(adminId)}/sme-status/${encodeURIComponent(smeId)}?admin_password=${encodeURIComponent(adminPassword)}`,
    { status }
  );

export interface SMELoginResponse {
  ok: boolean;
  role: "sme";
  sme_id: string;
  name: string;
  state: string;
  department: string;
}

export const smeLogin = (smeId: string, password: string) =>
  request<SMELoginResponse>("POST", "/sme/login", { sme_id: smeId, password });

export const updateReportStatusSME = (
  smeId: string,
  reportId: string,
  idToken: string,
  status: "in_progress" | "resolved",
  note?: string
) =>
  request<{ message: string; status: string }>(
    "POST",
    `/sme/${encodeURIComponent(smeId)}/reports/${encodeURIComponent(reportId)}/status`,
    { id_token: idToken, status, note }
  );
