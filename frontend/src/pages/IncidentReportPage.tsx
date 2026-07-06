import React, { useState, useRef } from "react";
import {
  Camera, MapPin, FileText, Send, CheckCircle, AlertTriangle,
  Upload, X, ArrowLeft, Waves,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as api from "../utils/api";

import { INDIA_STATES_DISTRICTS } from "../utils/india_states_districts";

const INDIAN_STATES = Object.keys(INDIA_STATES_DISTRICTS);

// ── Get or create an anonymous session ID for this browser ──────────────────
function getOrCreateSessionId(): string {
  const key = "aw_citizen_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `cit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export const IncidentReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ description: "", state: "", district: "", city: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (key === "state") {
        setForm((prev) => ({ ...prev, state: e.target.value, district: "" }));
      } else {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
      }
    };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) { setError("Please attach an image of the incident."); return; }
    setError("");
    setLoading(true);
    try {
      const citizenSessionId = getOrCreateSessionId();
      const body = new FormData();
      body.append("image", imageFile);
      body.append("description", form.description);
      body.append("state", form.state);
      body.append("district", form.district);
      body.append("city", form.city);
      body.append("citizen_session_id", citizenSessionId);

      const created = await api.submitIncidentReport(body);

      // Also store doc IDs locally so history page can cross-check
      const stored = JSON.parse(localStorage.getItem("aw_report_ids") || "[]");
      stored.push(created.id);
      localStorage.setItem("aw_report_ids", JSON.stringify(stored));
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";

  /* ── SUCCESS STATE ── */
  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-theme-base px-6 py-12 selection:bg-theme-accent selection:text-theme-text">
        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50">
              <CheckCircle className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <h2 className="mb-2 text-[22px] font-bold text-slate-900">Report Submitted</h2>
          <p className="mb-8 text-[14px] leading-relaxed text-slate-500">
            Your report has been received and will be reviewed by local authorities. Thank you for helping monitor water resources.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setSuccess(false); setForm({ description: "", state: "", district: "", city: "" }); setImageFile(null); setImagePreview(null); }}
              className="w-full rounded-lg bg-slate-900 py-3 text-[14px] font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Submit Another Report
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full rounded-lg border border-slate-200 py-3 text-[14px] font-semibold text-slate-700 hover:bg-theme-base transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── MAIN FORM ── */
  return (
    <div className="min-h-screen bg-theme-base relative overflow-hidden text-theme-text selection:bg-theme-accent selection:text-theme-text">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-400/20 blur-[120px] pointer-events-none" />


      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-white/50 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between h-full max-w-6xl px-6 mx-auto">
          {/* Logo */}
          <div className="flex justify-start flex-1">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2.5 focus:outline-none"
            >
              <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
              <span className="text-[15px] font-semibold text-slate-900">AquaWatch</span>
            </button>
          </div>

          <span className="text-[14px] font-semibold text-slate-700">Report Incident</span>

          {/* Back link */}
          <div className="flex items-center justify-end flex-1">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-[14px] font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Page body */}
      <main className="mx-auto max-w-[640px] px-6 py-14">

        {/* Page heading */}
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-slate-900">
            Report Water Incident
          </h1>
          <p className="text-[15px] leading-relaxed text-slate-500">
            Upload a photo and describe the crisis. No login required — your report goes directly to the local L1 Authority.
          </p>
        </div>

        {/* Form card */}
        <div className="relative z-10 rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl px-8 py-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-[13px] font-medium text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Image Upload ── */}
            <div>
              <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                Incident Photo <span className="text-red-500">*</span>
              </label>

              {imagePreview ? (
                <div className="relative overflow-hidden rounded-xl border border-slate-200">
                  <img src={imagePreview} alt="Preview" className="h-52 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/70 text-white hover:bg-slate-900 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300/60 bg-white/50 backdrop-blur-sm transition-all hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-slate-700">Click to upload photo</p>
                    <p className="mt-0.5 text-[13px] text-slate-400">JPG, PNG, WebP — max 10 MB</p>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            {/* ── Description ── */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                <FileText className="h-3.5 w-3.5" />
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={4}
                value={form.description}
                onChange={set("description")}
                className={`${inputBase} resize-none`}
                placeholder="Describe the water crisis — what you observed, severity, and who is affected…"
              />
            </div>

            {/* ── Location ── */}
            <div>
              <label className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">State</label>
                  <select value={form.state} onChange={set("state")} className={`${inputBase} appearance-none`}>
                    <option value="">Select state…</option>
                    {INDIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-slate-600">District</label>
                  <select
                    value={form.district}
                    onChange={set("district")}
                    disabled={!form.state}
                    className={`${inputBase} appearance-none disabled:bg-theme-base disabled:text-slate-400`}
                  >
                    <option value="">Select district…</option>
                    {form.state && INDIA_STATES_DISTRICTS[form.state]?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-[13px] font-medium text-slate-600">City / Area</label>
                <input value={form.city} onChange={set("city")} className={inputBase} placeholder="e.g. Salt Lake City" />
              </div>
            </div>

            {/* ── Notice ── */}
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-theme-base px-4 py-4">
              <Camera className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
              <p className="text-[13px] leading-relaxed text-slate-500">
                Exact coordinates are read from your photo's location data automatically, if present. Your report will be forwarded to the L1 Authority for your area. No personal information is required or stored.
              </p>
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 py-3.5 text-[15px] font-semibold text-white shadow-xl shadow-blue-500/20 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Incident Report
                </>
              )}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
};
