import React, { useState } from "react";
import { Check, X, ArrowUpRight, MapPin, Clock, Droplets } from "lucide-react";
import { getFullImageUrl } from "../utils/api";

export type ReportStatus = "pending" | "verified" | "rejected" | "escalated" | "assigned" | "in_progress" | "resolved";
export type SensorCategory = "critical" | "warning" | "normal" | "good";

export interface IncidentReport {
  id: string;
  imageUrl: string;
  location: { lat?: number | null; lng?: number | null; state?: string; district?: string };
  description: string;
  sensorReading: number;
  sensorCategory: SensorCategory;
  sensorBasedOnDays?: number;
  status: ReportStatus;
  createdAt: Date;
  aiAnalysis?: { summary?: string; hazardType?: string; severity?: string; confidence?: number } | null;
  assignedDepartments?: string[];
}

interface IncidentCardProps {
  report: IncidentReport;
  onVerify: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onEscalate: (id: string) => Promise<void>;
}

const categoryConfig: Record<SensorCategory, { label: string; text: string; bg: string; dot: string; border: string }> = {
  critical: { label: "Critical",  bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500", border: "border-red-100" },
  warning:  { label: "Warning",   bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-100" },
  normal:   { label: "Normal",    bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", border: "border-yellow-100" },
  good:     { label: "Good",      bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500", border: "border-green-100" },
};

const statusLabel: Record<ReportStatus, string> = {
  pending: "Pending", verified: "Verified", rejected: "Rejected",
  escalated: "Escalated", assigned: "Assigned", in_progress: "In Progress", resolved: "Resolved",
};

export const IncidentCard: React.FC<IncidentCardProps> = ({ report, onVerify, onReject, onEscalate }) => {
  const [busy, setBusy] = useState<"verify" | "reject" | "escalate" | null>(null);
  const cat = categoryConfig[report.sensorCategory];
  const canAct = report.status === "pending";

  const act = (type: "verify" | "reject" | "escalate", fn: (id: string) => Promise<void>) => async () => {
    setBusy(type);
    try { await fn(report.id); } finally { setBusy(null); }
  };

  return (
    <div className="group flex flex-col bg-white/70 backdrop-blur-md border border-white/60 rounded-xl overflow-hidden shadow-[0_4px_16px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:-translate-y-1 hover:border-blue-200/50 transition-all duration-300">
      
      {/* Image Area - Minimal */}
      {report.imageUrl && (
        <div className="relative h-40 w-full bg-slate-100 border-b border-slate-100">
          <img src={getFullImageUrl(report.imageUrl)} alt="Incident" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
      <div className="p-4 flex flex-col flex-1">
        {/* Header (Status & Date) */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-0.5 bg-slate-100 rounded-md">
            {statusLabel[report.status]}
          </span>
          <span className="text-[12px] text-slate-400 flex items-center gap-1 font-medium">
            <Clock className="h-3 w-3" />
            {report.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Description */}
        <p className="text-[14px] text-slate-800 leading-snug mb-4">
          {report.description || "No description provided."}
        </p>

        {/* Data Section */}
        <div className="mt-auto flex flex-col gap-3">
          
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

          {/* AI Insights - Linear Style Minimal row */}
          {report.aiAnalysis?.summary && (
            <div className="px-3 py-2.5 bg-theme-base/70 border border-slate-100 rounded-lg">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {report.aiAnalysis.summary}
              </p>
            </div>
          )}

          {/* Actions */}
          {canAct && (
            <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-slate-100">
              <button
                onClick={act("verify", onVerify)}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-all shadow-sm"
              >
                {busy === "verify" ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                Verify Incident
              </button>
              <div className="flex gap-2">
                <button
                  onClick={act("reject", onReject)}
                  disabled={busy !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200 hover:bg-theme-base hover:border-slate-300 disabled:opacity-50 text-slate-700 text-[13px] font-medium rounded-lg transition-all shadow-sm"
                >
                  {busy === "reject" ? <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <X className="h-4 w-4" />}
                  Reject
                </button>
                <button
                  onClick={act("escalate", onEscalate)}
                  disabled={busy !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 disabled:opacity-50 text-[13px] font-medium rounded-lg transition-all shadow-sm border border-blue-100"
                >
                  {busy === "escalate" ? <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  Escalate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
