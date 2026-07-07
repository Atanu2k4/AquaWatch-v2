import React, { useState } from "react";
import { Check, X, ArrowUpRight, MapPin, Clock, Droplets, History as HistoryIcon, ChevronDown, Map as MapIcon, Image as ImageIcon } from "lucide-react";
import { getFullImageUrl } from "../utils/api";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export type ReportStatus = "pending" | "verified" | "rejected" | "escalated" | "assigned" | "in_progress" | "resolved";
export type SensorCategory = "critical" | "warning" | "normal" | "good";

export interface ReportHistoryEntry {
  status: ReportStatus;
  actor_role: "l1" | "admin" | "sme";
  actor_id: string;
  at: Date;
  note?: string;
}

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
  history?: ReportHistoryEntry[];
}

interface IncidentCardProps {
  report: IncidentReport;
  onVerify: (id: string, note?: string) => Promise<void>;
  onReject: (id: string, note?: string) => Promise<void>;
  onEscalate: (id: string, note?: string) => Promise<void>;
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
  const [showHistory, setShowHistory] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [note, setNote] = useState("");
  const cat = categoryConfig[report.sensorCategory];
  const canAct = report.status === "pending";
  const hasCoords = report.location.lat != null && report.location.lng != null;

  const act = (type: "verify" | "reject" | "escalate", fn: (id: string, note?: string) => Promise<void>) => async () => {
    setBusy(type);
    try { await fn(report.id, note.trim() || undefined); setNote(""); } finally { setBusy(null); }
  };

  return (
    <div className="group flex flex-col bg-white/70 backdrop-blur-md border border-white/60 rounded-xl overflow-hidden shadow-[0_4px_16px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] hover:-translate-y-1 hover:border-blue-200/50 transition-all duration-300">
      
      {/* Image Area - Minimal */}
      {(report.imageUrl || hasCoords) && (
        <div className="relative h-48 w-full bg-slate-100 border-b border-slate-100">
          {showMap && hasCoords ? (
            <div className="w-full h-full z-0 relative">
              <MapContainer 
                center={[report.location.lat!, report.location.lng!]} 
                zoom={16} 
                className="w-full h-full"
                zoomControl={false}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="&copy; Esri World Imagery"
                  maxZoom={19}
                />
                <Marker position={[report.location.lat!, report.location.lng!]} />
              </MapContainer>
            </div>
          ) : (
            <>
              <img src={getFullImageUrl(report.imageUrl)} alt="Incident" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
              
              <div className="absolute bottom-2.5 left-3 flex flex-col text-white/90 drop-shadow-md">
                <div className="flex items-center text-xs font-medium">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  {report.location.district || report.location.state || "Unknown location"}
                </div>
                {hasCoords && (
                  <div className="text-[10px] text-white/70 ml-4.5 mt-0.5">
                    {report.location.lat?.toFixed(4)}, {report.location.lng?.toFixed(4)}
                  </div>
                )}
              </div>
            </>
          )}

          <div className={`absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border shadow-sm ${cat.text} ${cat.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
            {cat.label}
          </div>

          {hasCoords && (
            <button
              onClick={() => setShowMap(!showMap)}
              className="absolute bottom-2.5 right-3 z-10 flex items-center justify-center gap-1.5 bg-white/90 backdrop-blur-sm text-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm hover:bg-white transition-colors"
            >
              {showMap ? <><ImageIcon className="w-3.5 h-3.5" /> Photo</> : <><MapIcon className="w-3.5 h-3.5" /> Map</>}
            </button>
          )}
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

          {/* History */}
          {report.history && report.history.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="flex w-full items-center justify-between text-[12px] font-medium text-slate-500 hover:text-slate-700"
              >
                <span className="flex items-center gap-1.5">
                  <HistoryIcon className="h-3.5 w-3.5" />
                  History ({report.history.length})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>
              {showHistory && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {report.history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">
                          {statusLabel[h.status]} <span className="font-normal text-slate-400">by {h.actor_role} · {h.actor_id}</span>
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

          {/* Actions */}
          {canAct && (
            <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-slate-100">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (e.g. reason for rejecting/escalating)"
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 bg-theme-base px-3 py-2 text-[12px] outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              />
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
