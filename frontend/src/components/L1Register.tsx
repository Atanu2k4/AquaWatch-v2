import React, { useState } from "react";
import { ArrowLeft, UserCheck, Lock, User, MapPin, Building2, CheckCircle, Waves } from "lucide-react";
import * as api from "../utils/api";

interface L1RegisterProps {
  onBack: () => void;
}

import { INDIA_STATES_DISTRICTS } from "../utils/india_states_districts";

const INDIAN_STATES = Object.keys(INDIA_STATES_DISTRICTS);

export const L1Register: React.FC<L1RegisterProps> = ({ onBack }) => {
  const [form, setForm] = useState({ govt_id: "", name: "", password: "", state: "", district: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (key === "state") {
        setForm((prev) => ({ ...prev, state: e.target.value, district: "" }));
      } else {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.registerL1(form);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Govt ID may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white py-3 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";

  if (success) {
    return (
      <div className="min-h-screen bg-theme-base flex items-center justify-center px-6 py-12 selection:bg-theme-accent selection:text-theme-text">
        <div className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50">
              <CheckCircle className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <h2 className="mb-2 text-[22px] font-bold text-slate-900">Registration Submitted</h2>
          <p className="mb-1 text-[14px] text-slate-600">
            Application for <strong className="text-slate-900">{form.govt_id}</strong> is pending admin approval.
          </p>
          <p className="mb-8 text-[13px] text-slate-500">
            You can log in once your state admin approves your account.
          </p>
          <button
            onClick={onBack}
            className="w-full rounded-lg bg-slate-900 py-3 text-[14px] font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-base selection:bg-theme-accent selection:text-theme-text">
      <header className="h-16 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full max-w-6xl items-center px-6">
          <div className="flex items-center gap-2">
            <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
            <span className="text-[15px] font-semibold text-slate-900">AquaWatch</span>
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[460px]">
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-1.5 text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <UserCheck className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-[22px] font-bold text-slate-900">Register Access</h1>
              <p className="mt-1 text-[14px] text-slate-500">Pending admin approval after submission</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] font-medium text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Govt ID */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Government ID *</label>
                <div className="relative">
                  <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input required value={form.govt_id} onChange={set("govt_id")} className={`${inputBase} pl-9 pr-4`} placeholder="e.g. GOVT001" />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Full Name *</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input required value={form.name} onChange={set("name")} className={`${inputBase} pl-9 pr-4`} placeholder="Officer's full name" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Password *</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input required type="password" value={form.password} onChange={set("password")} minLength={6} className={`${inputBase} pl-9 pr-4`} placeholder="Min 6 characters" />
                </div>
              </div>

              {/* State + District */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-700">State *</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
                    <select required value={form.state} onChange={set("state")} className={`${inputBase} pl-9 pr-4 appearance-none`}>
                      <option value="">Select…</option>
                      {INDIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-700">District *</label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
                    <select
                      required
                      value={form.district}
                      onChange={set("district")}
                      disabled={!form.state}
                      className={`${inputBase} pl-9 pr-4 appearance-none disabled:bg-theme-base disabled:text-slate-400`}
                    >
                      <option value="">Select…</option>
                      {form.state && INDIA_STATES_DISTRICTS[form.state]?.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-[14px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting…
                  </>
                ) : (
                  "Submit Registration"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
