// src/utils/api.ts
// Typed service layer for the AquaWatch FastAPI backend (localhost:8000)

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = import.meta.env.VITE_BACKEND_API_KEY ?? "dev-local-key";

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
