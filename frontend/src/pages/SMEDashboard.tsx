// src/pages/SMEDashboard.tsx
import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase/config";
import {
  FlaskConical, LogOut, RefreshCw, CheckCircle, AlertTriangle, MapPin, Clock,
  Droplets, Building2, History as HistoryIcon, ChevronDown, PlayCircle, Loader2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../utils/api";
import { type IncidentReport, type SensorCategory } from "../components/IncidentCard";

const categoryConfig: Record<string, { label: string; text: string; bg: string; dot: string; border: string }> = {
  critical: { label: "Critical",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    border: "border-red-100" },
  warning:  { label: "Warning",   bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-100" },
  normal:   { label: "Normal",    bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-100" },
  good:     { label: "Good",      bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  border: "border-green-100" },
};

const statusLabel: Record<string, string> = {
  pending: "Pending", verified: "Verified", rejected: "Rejected",
  escalated: "Escalated", assigned: "Assigned",
  in_progress: "In Progress", resolved: "Resolved",
};

const statusStyle: Record<string, string> = {
  assigned:    "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-green-100 text-green-700",
};

export const SMEDashboard: React.FC = () => {
  const { userData, logout } = useAuth();
  const smeId   = (userData as any)?.smeId ?? "";
  const smeName = (userData as any)?.name ?? smeId;
  const smeState = (userData as any)?.state ?? "";
  const smeDept = (userData as any)?.department ?? "";

  const [reports, setReports]           = useState<IncidentReport[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [message, setMessage]           = useState<{ ok: boolean; text: string } | null>(null);
  const [notes, setNotes]               = useState<Record<string, string>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [actingId, setActingId]         = useState<string | null>(null);

  const showMsg = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const reportsRef = collection(db, "IncidentReports");
      // Show reports that are assigned or in_progress, scoped to SME's state
      const statuses = ["assigned", "in_progress"];
      const q = smeState
        ? query(reportsRef, where("status", "in", statuses), where("location.state", "==", smeState))
        : query(reportsRef, where("status", "in", statuses));
      const snap = await getDocs(q);
      const all: IncidentReport[] = snap.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          imageUrl:         r.imageUrl ?? "",
          location:         r.location ?? {},
          description:      r.description ?? "",
          sensorReading:    r.sensorReading ?? 0,
          sensorCategory:   (r.sensorCategory ?? "normal") as SensorCategory,
          sensorBasedOnDays: r.sensorBasedOnDays ?? 0,
          status:           r.status ?? "assigned",
          createdAt:        r.createdAt?.toDate?.() ?? new Date(),
          aiAnalysis:       r.aiAnalysis ?? null,
          assignedDepartments: r.assignedDepartments ?? [],
          history:          (r.history ?? []).map((h: any) => ({ ...h, at: h.at?.toDate?.() ?? new Date() })),
        };
      });
      // Filter to only reports that include this SME's department
      const mine = smeDept
        ? all.filter((r) => (r.assignedDepartments ?? []).includes(smeDept))
        : all;
      mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setReports(mine);
    } catch (err) {
      console.error("SME: error loading reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, [smeId, smeState, smeDept]);

  const getToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return user.getIdToken();
  };

  const handleAction = async (reportId: string, status: "in_progress" | "resolved") => {
    setActingId(reportId);
    try {
      const token = await getToken();
      await api.updateReportStatusSME(smeId, reportId, token, status, notes[reportId]?.trim() || undefined);
      setReports((prev) =>
        status === "resolved"
          ? prev.filter((r) => r.id !== reportId)
          : prev.map((r) => r.id === reportId ? { ...r, status: "in_progress" } : r)
      );
      setNotes((prev) => { const next = { ...prev }; delete next[reportId]; return next; });
      showMsg(true, status === "resolved" ? "Report marked as resolved." : "Report moved to In Progress.");
    } catch (err: any) {
      showMsg(false, `Action failed: ${err.message}`);
    } finally {
      setActingId(null);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const assignedCount    = reports.filter(r => r.status === "assigned").length;
  const inProgressCount  = reports.filter(r => r.status === "in_progress").length;

  return (
    <div className="flex min-h-screen flex-col bg-theme-base font-sans text-theme-text">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-white/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between h-full max-w-6xl px-6 mx-auto">
          <div className="flex items-center gap-2">
            <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
            <span className="text-[15px] font-semibold text-slate-900">AquaWatch</span>
          </div>
          <span className="text-[14px] font-semibold text-slate-700">SME Dashboard</span>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
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

      <main className="max-w-5xl px-6 py-8 mx-auto w-full">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              SME Portal
            </span>
          </div>
          <h1 className="mb-2 text-[28px] font-bold tracking-tight text-slate-900">
            Welcome, {smeName}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            {smeDept && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-3 py-1 text-[12px] font-semibold text-violet-700">
                <Building2 className="h-3.5 w-3.5" />
                {smeDept}
              </span>
            )}
            {smeState && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-600">
                <MapPin className="h-3.5 w-3.5" />
                {smeState}
              </span>
            )}
          </div>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-500">
            Review and action the incident reports routed to your department.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-2">
          <div className="rounded-xl bg-white/60 backdrop-blur-md border border-white/60 shadow-sm p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Awaiting Action</p>
            <p className="text-[32px] font-bold text-slate-900">{assignedCount}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Reports assigned to you</p>
          </div>
          <div className="rounded-xl bg-white/60 backdrop-blur-md border border-white/60 shadow-sm p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-1">In Progress</p>
            <p className="text-[32px] font-bold text-amber-600">{inProgressCount}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Currently being worked on</p>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 flex items-start gap-2 rounded-xl p-4 text-[14px] ${
            message.ok
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {message.ok
              ? <CheckCircle className="mt-0.5 h-4 w-4" />
              : <AlertTriangle className="mt-0.5 h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Reports Section */}
        <div>
          <h2 className="mb-4 text-[18px] font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-600" />
            Your Assigned Reports
          </h2>

          {loading ? (
            <div className="flex items-center justify-center h-48 bg-white border rounded-2xl border-slate-200">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 rounded-full animate-spin border-violet-600/30 border-t-violet-600" />
                <span className="text-[13px] text-slate-500">Loading reports…</span>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-2xl border-slate-300 bg-theme-base/50">
              <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-slate-100">
                <CheckCircle className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[15px] font-medium text-slate-900">No reports assigned yet</p>
              <p className="mt-1 text-[14px] text-slate-500">
                Reports routed to <span className="font-medium">{smeDept || "your department"}</span> in <span className="font-medium">{smeState || "your state"}</span> will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reports.map((report) => {
                const cat = categoryConfig[report.sensorCategory] || categoryConfig.normal;
                const isActing = actingId === report.id;
                return (
                  <div
                    key={report.id}
                    className="group flex flex-col overflow-hidden transition-all duration-300 bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_4px_16px_rgb(0,0,0,0.04)] rounded-xl hover:border-violet-200/50 hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:-translate-y-1"
                  >
                    {/* Image */}
                    {report.imageUrl && (
                      <div className="relative w-full h-40 bg-slate-100 border-b border-slate-100">
                        <img
                          src={api.getFullImageUrl(report.imageUrl)}
                          alt="Incident"
                          className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                        />
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

                    {/* Content */}
                    <div className="flex flex-col flex-1 p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${statusStyle[report.status] ?? "bg-slate-100 text-slate-500"}`}>
                          {statusLabel[report.status]}
                        </span>
                        <span className="flex items-center gap-1 text-[12px] font-medium text-slate-400">
                          <Clock className="w-3 h-3" />
                          {report.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="mb-3 text-[14px] leading-snug text-slate-800 line-clamp-3">
                        {report.description || "No description provided."}
                      </p>

                      {/* Assigned Departments */}
                      {(report.assignedDepartments ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(report.assignedDepartments ?? []).map((d) => (
                            <span
                              key={d}
                              className={`rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                                d === smeDept
                                  ? "bg-violet-100 text-violet-700 border-violet-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* AI Analysis */}
                      {report.aiAnalysis?.summary && (
                        <div className="px-3 py-2.5 bg-theme-base/70 border border-slate-100 rounded-lg mb-3">
                          <p className="text-[12px] text-slate-500 font-medium mb-0.5">AI Analysis</p>
                          <p className="text-[13px] text-slate-600 leading-relaxed">{report.aiAnalysis.summary}</p>
                        </div>
                      )}

                      <div className="mt-auto flex flex-col gap-3">
                        {/* Sensor Reading */}
                        <div className="flex items-center justify-between px-3 py-2 bg-theme-base border border-slate-100 rounded-lg">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Droplets className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[12px] font-medium">Sensor Level</span>
                          </div>
                          <span className={`text-[13px] font-bold ${cat.text}`}>{report.sensorReading}%</span>
                        </div>

                        {/* History */}
                        {(report.history ?? []).length > 0 && (
                          <div className="border-t border-slate-100 pt-2">
                            <button
                              onClick={() => setExpandedHistory((prev) => ({ ...prev, [report.id]: !prev[report.id] }))}
                              className="flex w-full items-center justify-between text-[12px] font-medium text-slate-500 hover:text-slate-700"
                            >
                              <span className="flex items-center gap-1.5">
                                <HistoryIcon className="h-3.5 w-3.5" />
                                History ({(report.history ?? []).length})
                              </span>
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedHistory[report.id] ? "rotate-180" : ""}`} />
                            </button>
                            {expandedHistory[report.id] && (
                              <ul className="mt-2 flex flex-col gap-1.5">
                                {(report.history ?? []).map((h, i) => (
                                  <li key={i} className="flex items-start justify-between text-[11px] text-slate-500">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-slate-700">
                                        {statusLabel[h.status] ?? h.status}{" "}
                                        <span className="font-normal text-slate-400">by {h.actor_role} · {h.actor_id}</span>
                                      </span>
                                      {h.note && <span className="text-slate-400 italic">"{h.note}"</span>}
                                    </div>
                                    <span className="shrink-0 pl-2">
                                      {h.at.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {/* Action Panel */}
                        <div className="pt-3 border-t border-slate-100">
                          <textarea
                            value={notes[report.id] ?? ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                            placeholder="Optional expert note / findings"
                            rows={2}
                            className="mb-2 w-full resize-none rounded-lg border border-slate-200 bg-theme-base px-3 py-2 text-[12px] outline-none transition-all focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
                          />

                          {report.status === "assigned" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(report.id, "in_progress")}
                                disabled={isActing}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 py-2 text-[13px] font-semibold text-amber-700 transition-all hover:bg-amber-100 disabled:opacity-50"
                              >
                                {isActing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <PlayCircle className="h-3.5 w-3.5" />
                                )}
                                Start Work
                              </button>
                              <button
                                onClick={() => handleAction(report.id, "resolved")}
                                disabled={isActing}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2 text-[13px] font-semibold text-white transition-all hover:bg-green-700 shadow-sm disabled:opacity-50"
                              >
                                {isActing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5" />
                                )}
                                Mark Resolved
                              </button>
                            </div>
                          )}

                          {report.status === "in_progress" && (
                            <button
                              onClick={() => handleAction(report.id, "resolved")}
                              disabled={isActing}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-[13px] font-semibold text-white transition-all shadow-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {isActing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
