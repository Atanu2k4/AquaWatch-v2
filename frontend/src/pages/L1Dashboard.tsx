import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { IncidentCard, type IncidentReport, type ReportStatus } from "../components/IncidentCard";
import { UserCheck, Inbox, Filter, RefreshCw, MapPin, LogOut } from "lucide-react";

type FilterType = "all" | "pending" | "verified" | "rejected" | "escalated";

export const L1Dashboard: React.FC = () => {
  const { userData, logout, loading: authLoading } = useAuth();
  const l1Data = userData as any;

  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const reportsRef = collection(db, "IncidentReports");
      let q = query(reportsRef);

      if (l1Data?.district) {
        q = query(reportsRef, where("location.district", "==", l1Data.district));
      } else if (l1Data?.state) {
        q = query(reportsRef, where("location.state", "==", l1Data.state));
      }

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
        };
      });

      data.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setReports(data);
    } catch (err) {
      console.error("Error loading reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;   // wait for userData restore on reload before querying — else it fires unfiltered
    loadReports();
  }, [authLoading, l1Data?.state, l1Data?.district]);

  const refresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const updateStatus = async (id: string, status: ReportStatus) => {
    await updateDoc(doc(db, "IncidentReports", id), { status, updatedAt: serverTimestamp() });
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);

  const counts = {
    all: reports.length,
    pending: reports.filter(r => r.status === "pending").length,
    verified: reports.filter(r => r.status === "verified").length,
    rejected: reports.filter(r => r.status === "rejected").length,
    escalated: reports.filter(r => r.status === "escalated").length,
  };

  const filterLabels: Record<FilterType, string> = {
    all: `All (${counts.all})`,
    pending: `Pending (${counts.pending})`,
    verified: `Verified (${counts.verified})`,
    rejected: `Rejected (${counts.rejected})`,
    escalated: `Escalated (${counts.escalated})`,
  };

  return (
    <div className="flex min-h-screen flex-col bg-theme-base font-sans text-theme-text selection:bg-theme-accent selection:text-theme-text">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-white/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex flex-1 justify-start">
            <div className="flex items-center gap-3">
              <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900 leading-tight">L1 Authority Dashboard</h1>
                <div className="flex items-center space-x-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-blue-600" />
                  <p className="text-[12px] font-medium text-slate-500 leading-tight">
                    {l1Data?.district || l1Data?.state || "All Districts"}
                    {l1Data?.govtId && <span className="ml-1">· {l1Data.govtId}</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2 sm:px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8 flex-1">
        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Pending", count: counts.pending, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
            { label: "Verified", count: counts.verified, color: "text-green-600", bg: "bg-green-50 border-green-100" },
            { label: "Escalated", count: counts.escalated, color: "text-red-600", bg: "bg-red-50 border-red-100" },
            { label: "Total", count: counts.all, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
          ].map(s => (
            <div key={s.label} className={`flex flex-col rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${s.bg}`}>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className={`text-[24px] font-bold ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <Filter className="mr-2 h-4 w-4 text-slate-400" />
          {(Object.keys(filterLabels) as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                filter === f
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                  : "bg-white/60 backdrop-blur-md text-slate-600 border border-slate-200/60 hover:bg-white hover:shadow-sm"
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>

        {/* Reports grid */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
            <p className="text-[14px] text-slate-500">Loading incident reports…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-theme-base/50">
            <Inbox className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-[15px] font-semibold text-slate-900">No reports found</p>
            <p className="mt-1 text-[13px] text-slate-500">
              {filter !== "all" ? "Try changing the filter." : "No incident reports have been submitted for your district yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map(report => (
              <IncidentCard
                key={report.id}
                report={report}
                onVerify={id => updateStatus(id, "verified")}
                onReject={id => updateStatus(id, "rejected")}
                onEscalate={id => updateStatus(id, "escalated")}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
