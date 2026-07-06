// src/components/AdminDashboard.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import { Shield, UserCheck, CheckCircle, XCircle, LogOut, RefreshCw, AlertTriangle, Waves, Building2, Send, MapPin, Clock, Droplets, Users, UploadCloud, History as HistoryIcon, ChevronDown, FlaskConical } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../utils/api";
import { type IncidentReport, type ReportStatus, type SensorCategory } from "../components/IncidentCard";

// state name -> admin_id prefix code, mirrors backend/main.py's STATE_CODES
const STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "JK", "Ladakh": "LA", "Himachal Pradesh": "HP", "Punjab": "PB",
  "Uttarakhand": "UK", "Haryana": "HR", "Delhi": "DL", "Uttar Pradesh": "UP",
  "Bihar": "BR", "Sikkim": "SK", "Arunachal Pradesh": "AR", "Nagaland": "NL",
  "Manipur": "MN", "Mizoram": "MZ", "Tripura": "TR", "Meghalaya": "ML",
  "Assam": "AS", "West Bengal": "WB", "Jharkhand": "JH", "Odisha": "OD",
  "Chhattisgarh": "CT", "Madhya Pradesh": "MP", "Rajasthan": "RJ", "Gujarat": "GJ",
  "Maharashtra": "MH", "Telangana": "TS", "Andhra Pradesh": "AP", "Karnataka": "KA",
  "Goa": "GA", "Kerala": "KL", "Tamil Nadu": "TN",
};

const stateForAdmin = (adminId: string): string | null => {
  const code = adminId.split("@")[0].toUpperCase();
  return Object.keys(STATE_CODES).find(name => STATE_CODES[name] === code) ?? null;
};

const AdminDashboard: React.FC = () => {
  const { userData, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const adminId = (userData as any)?.id ?? "";
  const adminState = adminId ? stateForAdmin(adminId) : null;

  const [pendingAuthorities, setPendingAuthorities] = useState<api.PendingL1[]>([]);
  const [pendingSMEs, setPendingSMEs] = useState<api.SMEProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Already known from login (in-memory only, not persisted across reload — see AuthContext) — no need to ask again.
  const [approvalPassword, setApprovalPassword] = useState((userData as any)?.password ?? "");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvingSMEId, setApprovingSMEId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [departmentSelections, setDepartmentSelections] = useState<Record<string, string[]>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  const [uploadPassword, setUploadPassword] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const DEPARTMENTS = [
    "Water Supply Board",
    "Public Works Department (PWD)",
    "Municipal Corporation",
    "Environmental Protection",
    "Disaster Management"
  ];

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const reportsRef = collection(db, "IncidentReports");
      const statuses = ["verified", "escalated", "assigned", "in_progress"];
      const q = adminState
        ? query(reportsRef, where("status", "in", statuses), where("location.state", "==", adminState))
        : query(reportsRef, where("status", "in", statuses));
      const snap = await getDocs(q);
      const data: IncidentReport[] = snap.docs.map(d => {
        const r = d.data();
        return {
          id: d.id,
          imageUrl: r.imageUrl ?? "",
          location: r.location ?? {},
          description: r.description ?? "",
          sensorReading: r.sensorReading ?? 0,
          sensorCategory: r.sensorCategory ?? "normal",
          sensorBasedOnDays: r.sensorBasedOnDays ?? 0,
          status: r.status ?? "pending",
          createdAt: r.createdAt?.toDate?.() ?? new Date(),
          aiAnalysis: r.aiAnalysis ?? null,
          assignedDepartments: r.assignedDepartments ?? [],
          history: (r.history ?? []).map((h: any) => ({ ...h, at: h.at?.toDate?.() ?? new Date() })),
        };
      });
      data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setReports(data);
    } catch (err) {
      console.error("Error loading reports:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;   // wait for userData restore on reload before querying — else id/state isn't resolved yet
    loadReports();
    if (approvalPassword) loadPending(approvalPassword);
    else setLoading(false);
  }, [authLoading, adminId, adminState]);

  const loadPending = async (password: string) => {
    if (!password) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [l1Res, smeRes] = await Promise.all([
        api.getPendingL1(adminId, password),
        api.getPendingSME(adminId, password),
      ]);
      setPendingAuthorities(l1Res.pending || []);
      setPendingSMEs(smeRes.pending || []);
      setMessage(null);
    } catch (err: any) {
      setMessage({ ok: false, text: "Failed to load pending authorities. Invalid password?" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (govtId: string) => {
    if (!approvalPassword) {
      setMessage({ ok: false, text: "Admin password is required to approve." });
      return;
    }
    setApprovingId(govtId);
    try {
      await api.approveL1(govtId, adminId, approvalPassword);
      setMessage({ ok: true, text: `Successfully approved L1 officer ${govtId}.` });
      setPendingAuthorities(prev => prev.filter(a => a.govt_id !== govtId));
    } catch (err: any) {
      setMessage({ ok: false, text: `Approval failed: ${err.message}` });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveSME = async (smeId: string) => {
    if (!approvalPassword) {
      setMessage({ ok: false, text: "Admin password is required to approve." });
      return;
    }
    setApprovingSMEId(smeId);
    try {
      await api.approveSME(smeId, adminId, approvalPassword);
      setMessage({ ok: true, text: `Successfully approved SME ${smeId}.` });
      setPendingSMEs(prev => prev.filter(s => s.sme_id !== smeId));
    } catch (err: any) {
      setMessage({ ok: false, text: `SME approval failed: ${err.message}` });
    } finally {
      setApprovingSMEId(null);
    }
  };

  const toggleDepartment = (reportId: string, dept: string) => {
    setDepartmentSelections(prev => {
      const current = prev[reportId] || [];
      if (current.includes(dept)) {
        return { ...prev, [reportId]: current.filter(d => d !== dept) };
      } else {
        return { ...prev, [reportId]: [...current, dept] };
      }
    });
  };

  const handleAssign = async (reportId: string) => {
    const depts = departmentSelections[reportId] || [];
    if (depts.length === 0) {
      setMessage({ ok: false, text: "Please select at least one department." });
      return;
    }
    if (!approvalPassword) {
      setMessage({ ok: false, text: "Enter your admin password above (L1 Authority Approvals section) first." });
      return;
    }
    setAssigningId(reportId);
    try {
      await api.updateReportStatusAdmin(adminId, approvalPassword, reportId, "assigned", depts, reportNotes[reportId]?.trim() || undefined);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "assigned", assignedDepartments: depts } : r));
      setMessage({ ok: true, text: "Report successfully assigned to departments." });
      setDepartmentSelections(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
      setReportNotes(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    } catch (err: any) {
      setMessage({ ok: false, text: `Failed to assign report: ${err.message}` });
    } finally {
      setAssigningId(null);
    }
  };

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (reportId: string) => {
    if (!approvalPassword) {
      setMessage({ ok: false, text: "Enter your admin password above (L1 Authority Approvals section) first." });
      return;
    }
    setResolvingId(reportId);
    try {
      await api.updateReportStatusAdmin(adminId, approvalPassword, reportId, "resolved", undefined, reportNotes[reportId]?.trim() || undefined);
      setReports(prev => prev.filter(r => r.id !== reportId));
      setMessage({ ok: true, text: "Report marked resolved." });
      setReportNotes(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    } catch (err: any) {
      setMessage({ ok: false, text: `Failed to resolve report: ${err.message}` });
    } finally {
      setResolvingId(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setMessage({ ok: false, text: "Choose a CSV file first." });
      return;
    }
    if (!uploadPassword) {
      setMessage({ ok: false, text: "Admin password is required to upload." });
      return;
    }
    setUploading(true);
    try {
      const res = await api.uploadStateCsv(adminId, uploadPassword, uploadFile);
      setMessage({
        ok: true,
        text: `${res.message}${res.skipped_other_state ? ` (${res.skipped_other_state} row(s) skipped — different state)` : ""}`,
      });
      setUploadFile(null);
    } catch (err: any) {
      setMessage({ ok: false, text: `Upload failed: ${err.message}` });
    } finally {
      setUploading(false);
    }
  };

  const categoryConfig: Record<string, { label: string; text: string; bg: string; dot: string; border: string }> = {
    critical: { label: "Critical",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500", border: "border-red-100" },
    warning:  { label: "Warning",   bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-100" },
    normal:   { label: "Normal",    bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-100" },
    good:     { label: "Good",      bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500", border: "border-green-100" },
  };

  return (
    <div className="flex min-h-screen flex-col bg-theme-base font-sans text-theme-text selection:bg-theme-accent selection:text-theme-text">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-white/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between h-full max-w-6xl px-6 mx-auto">
          <div className="flex justify-start flex-1">
            <div className="flex items-center gap-2">
              <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
              <span className="text-[15px] font-semibold text-slate-900">AquaWatch</span>
            </div>
          </div>
          <span className="text-[14px] font-semibold text-slate-700">State Admin Dashboard</span>
          <div className="flex items-center justify-end flex-1 gap-3">
            <button
              onClick={() => navigate("/admin/users")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100"
            >
              <Users className="w-4 h-4" />
              L1 Management
            </button>
            <button
              onClick={() => {
                setRefreshing(true);
                Promise.all([
                  approvalPassword ? loadPending(approvalPassword) : Promise.resolve(),
                  loadReports()
                ]).then(() => setRefreshing(false));
              }}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl px-6 py-8 mx-auto">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5">
            <Shield className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Admin Portal
            </span>
          </div>
          <h1 className="mb-3 text-[28px] font-bold tracking-tight text-slate-900">
            State Administration
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-slate-500">
            Manage field officers and delegate escalated incident reports to the appropriate departments.
          </p>
        </div>

        {message && (
          <div className={`mb-6 flex items-start gap-2 rounded-xl p-4 text-[14px] ${
            message.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {message.ok ? <CheckCircle className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* --- SECTION: L1 Authority Approvals --- */}
        <div className="mb-10">
          <h2 className="mb-4 text-[18px] font-bold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            L1 Authority Approvals
          </h2>
          
          {!approvalPassword && (
            <div className="p-6 mb-4 bg-white/60 backdrop-blur-md border border-white/60 shadow-lg rounded-2xl">
              <p className="mb-4 text-[14px] text-slate-500">
                Session password expired after reload — enter it again to view and approve pending L1 authorities.
              </p>
              <div className="flex flex-col max-w-md gap-3 sm:flex-row">
                <input
                  type="password"
                  placeholder="Admin Password"
                  value={approvalPassword}
                  onChange={(e) => setApprovalPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadPending(approvalPassword)}
                  className="flex-1 rounded-lg border border-slate-200 bg-theme-base px-4 py-2 text-[14px] outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
                <button
                  onClick={() => loadPending(approvalPassword)}
                  className="rounded-lg bg-slate-900 px-6 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  View Pending
                </button>
              </div>
            </div>
          )}

          {approvalPassword && !loading && (
            <div className="overflow-hidden bg-white/60 backdrop-blur-md border border-white/60 shadow-lg rounded-2xl">
              <div className="px-6 py-4 border-b border-white/50 bg-white/40">
                <h3 className="text-[14px] font-semibold text-slate-900">
                  Pending Approvals ({pendingAuthorities.length})
                </h3>
              </div>
              
              {pendingAuthorities.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex items-center justify-center w-10 h-10 mb-3 rounded-full bg-slate-100">
                    <CheckCircle className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-[14px] font-medium text-slate-900">All caught up!</p>
                  <p className="text-[13px] text-slate-500">No pending authorities found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingAuthorities.map((auth) => (
                    <div key={auth.govt_id} className="flex flex-col justify-between gap-4 p-5 transition-colors sm:flex-row sm:items-center hover:bg-theme-base/50">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-[15px] font-semibold text-slate-900">{auth.name}</h4>
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">Pending</span>
                        </div>
                        <p className="text-[13px] text-slate-500 mb-2">Govt ID: <span className="font-medium text-slate-700">{auth.govt_id}</span></p>
                        <div className="flex gap-2">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                            State: {auth.assigned_location.state}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                            District: {auth.assigned_location.district}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleApprove(auth.govt_id)}
                        disabled={approvingId === auth.govt_id}
                        className="inline-flex min-w-[100px] items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {approvingId === auth.govt_id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: SME / Authority Approvals --- */}
        <div className="mb-10">
          <h2 className="mb-4 text-[18px] font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-600" />
            SME / Authority Approvals
          </h2>

          {approvalPassword && !loading && (
            <div className="overflow-hidden bg-white/60 backdrop-blur-md border border-white/60 shadow-lg rounded-2xl">
              <div className="px-6 py-4 border-b border-white/50 bg-white/40">
                <h3 className="text-[14px] font-semibold text-slate-900">
                  Pending SME Approvals ({pendingSMEs.length})
                </h3>
              </div>
              {pendingSMEs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="flex items-center justify-center w-10 h-10 mb-3 rounded-full bg-slate-100">
                    <CheckCircle className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-[14px] font-medium text-slate-900">All caught up!</p>
                  <p className="text-[13px] text-slate-500">No pending SME authorities found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingSMEs.map((sme) => (
                    <div key={sme.sme_id} className="flex flex-col justify-between gap-4 p-5 transition-colors sm:flex-row sm:items-center hover:bg-theme-base/50">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-[15px] font-semibold text-slate-900">{sme.name}</h4>
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">Pending</span>
                        </div>
                        <p className="text-[13px] text-slate-500 mb-2">SME ID: <span className="font-medium text-slate-700">{sme.sme_id}</span></p>
                        <div className="flex gap-2 flex-wrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                            State: {sme.state}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 border border-violet-100">
                            {sme.department}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleApproveSME(sme.sme_id)}
                        disabled={approvingSMEId === sme.sme_id}
                        className="inline-flex min-w-[100px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                      >
                        {approvingSMEId === sme.sme_id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <><CheckCircle className="h-3.5 w-3.5" /> Approve</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: Upload Sensor Data CSV --- */}
        <div className="mb-10">
          <h2 className="mb-4 text-[18px] font-bold text-slate-900 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            Upload Sensor Data ({adminState || "Unknown state"})
          </h2>
          <div className="p-6 bg-white/60 backdrop-blur-md border border-white/60 shadow-lg rounded-2xl">
            <p className="mb-4 text-[14px] text-slate-500">
              Upload a CSV (columns: state_name, date, station_name, currentlevel, ...) to push readings into MongoDB and Firebase
              without waiting on the live feed. Only rows matching your state ({adminState || "—"}) are written.
            </p>
            <div className="flex flex-col max-w-lg gap-3 sm:flex-row">
              <input
                type="password"
                placeholder="Admin Password"
                value={uploadPassword}
                onChange={(e) => setUploadPassword(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-theme-base px-4 py-2 text-[14px] outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="flex-1 rounded-lg border border-slate-200 bg-theme-base px-3 py-2 text-[13px] outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-white"
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-6 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {uploading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  "Upload"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* --- SECTION: Escalated Reports Routing --- */}
        <div>
          <h2 className="mb-4 text-[18px] font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Route Verified & Escalated Reports
          </h2>

          {loadingReports ? (
            <div className="flex items-center justify-center h-48 bg-white border rounded-2xl border-slate-200">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 rounded-full animate-spin border-blue-600/30 border-t-blue-600" />
                <span className="text-[13px] text-slate-500">Loading reports...</span>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-2xl border-slate-300 bg-theme-base/50">
              <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-slate-100">
                <CheckCircle className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[15px] font-medium text-slate-900">No reports to route</p>
              <p className="mt-1 text-[14px] text-slate-500">There are currently no verified or escalated reports waiting for department assignment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reports.map((report) => {
                const cat = categoryConfig[report.sensorCategory] || categoryConfig.normal;
                return (
                <div key={report.id} className="group flex flex-col overflow-hidden transition-all duration-300 bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_4px_16px_rgb(0,0,0,0.04)] rounded-xl hover:border-blue-200/50 hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:-translate-y-1">
                  
                  {/* Image Area - Minimal */}
                  {report.imageUrl && (
                    <div className="relative w-full h-40 bg-slate-100 border-b border-slate-100">
                      <img src={api.getFullImageUrl(report.imageUrl)} alt="Incident" className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
                      
                      <div className="absolute bottom-2.5 left-3 flex items-center text-white/90 text-xs font-medium drop-shadow-md">
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        {report.location.district || report.location.state || "Unknown location"}
                      </div>
            
                      <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border shadow-sm ${cat.text} ${cat.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                        {cat.label}
                      </div>
                    </div>
                  )}

                  {/* Content Area */}
                  <div className="flex flex-col flex-1 p-4">
                    {/* Header (Status & Date) */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {report.status}
                      </span>
                      <span className="flex items-center gap-1 text-[12px] font-medium text-slate-400">
                        <Clock className="w-3 h-3" />
                        {report.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="mb-4 text-[14px] leading-snug text-slate-800 line-clamp-3">
                      {report.description || "No description provided."}
                    </p>

                    <div className="flex flex-col gap-3 mt-auto">
                      {/* Sensor Reading - Linear Style Minimal row */}
                      <div className="flex items-center justify-between px-3 py-2 bg-theme-base border border-slate-100 rounded-lg">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Droplets className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[12px] font-medium">Sensor Level</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-bold ${cat.text}`}>{report.sensorReading}%</span>
                        </div>
                      </div>

                      {/* History */}
                      {report.history && report.history.length > 0 && (
                        <div className="border-t border-slate-100 pt-2">
                          <button
                            onClick={() => setExpandedHistory(prev => ({ ...prev, [report.id]: !prev[report.id] }))}
                            className="flex w-full items-center justify-between text-[12px] font-medium text-slate-500 hover:text-slate-700"
                          >
                            <span className="flex items-center gap-1.5">
                              <HistoryIcon className="h-3.5 w-3.5" />
                              History ({report.history.length})
                            </span>
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedHistory[report.id] ? "rotate-180" : ""}`} />
                          </button>
                          {expandedHistory[report.id] && (
                            <ul className="mt-2 flex flex-col gap-1.5">
                              {report.history.map((h, i) => (
                                <li key={i} className="flex items-start justify-between text-[11px] text-slate-500">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-700">
                                      {h.status} <span className="font-normal text-slate-400">by {h.actor_role} · {h.actor_id}</span>
                                    </span>
                                    {h.note && <span className="text-slate-400 italic">"{h.note}"</span>}
                                  </div>
                                  <span className="shrink-0 pl-2">{h.at.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Department Actions */}
                      <div className="pt-3 mt-1 border-t border-slate-100">
                        {report.status === "assigned" ? (
                          <>
                            <p className="mb-2 text-[12px] font-semibold text-slate-900">
                              Assigned to: {(report.assignedDepartments || []).join(", ") || "—"}
                            </p>
                            <textarea
                              value={reportNotes[report.id] ?? ""}
                              onChange={(e) => setReportNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                              placeholder="Optional resolution note"
                              rows={2}
                              className="mb-2 w-full resize-none rounded-lg border border-slate-200 bg-theme-base px-3 py-2 text-[12px] outline-none transition-all focus:border-green-500 focus:bg-white focus:ring-4 focus:ring-green-500/10"
                            />
                            <button
                              onClick={() => handleResolve(report.id)}
                              disabled={resolvingId === report.id}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-[13px] font-semibold text-white transition-all shadow-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {resolvingId === report.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                "Mark Resolved"
                              )}
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="mb-2 text-[12px] font-semibold text-slate-900">Assign Departments:</p>
                            <textarea
                              value={reportNotes[report.id] ?? ""}
                              onChange={(e) => setReportNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                              placeholder="Optional assignment note"
                              rows={2}
                              className="mb-2 w-full resize-none rounded-lg border border-slate-200 bg-theme-base px-3 py-2 text-[12px] outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                            />
                            <div className="flex flex-wrap gap-2 mb-4">
                              {DEPARTMENTS.map(dept => {
                                const isSelected = (departmentSelections[report.id] || []).includes(dept);
                                return (
                                  <button
                                    key={dept}
                                    onClick={() => toggleDepartment(report.id, dept)}
                                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                      isSelected
                                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                                        : "bg-theme-base text-slate-600 border border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    {dept}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => handleAssign(report.id)}
                              disabled={assigningId === report.id || !(departmentSelections[report.id]?.length > 0)}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 text-[13px] font-semibold text-white transition-all shadow-sm hover:bg-slate-800 hover:shadow-md disabled:opacity-50"
                            >
                              {assigningId === report.id ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" /> Route to Departments
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

