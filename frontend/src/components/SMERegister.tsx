import React, { useState } from "react";
import { ArrowLeft, FlaskConical, Lock, Eye, EyeOff, User, Building2, MapPin } from "lucide-react";
import * as api from "../utils/api";

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu and Kashmir","Ladakh",
];

const DEPARTMENTS = [
  "Water Supply Board",
  "Public Works Department (PWD)",
  "Municipal Corporation",
  "Environmental Protection",
  "Disaster Management",
];

interface SMERegisterProps {
  onBack: () => void;
}

export const SMERegister: React.FC<SMERegisterProps> = ({ onBack }) => {
  const [smeId, setSmeId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white py-3 text-[14px] text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!state) {
      setError("Please select your state.");
      return;
    }
    if (!department) {
      setError("Please select your department.");
      return;
    }

    setLoading(true);
    try {
      await api.registerSME({ sme_id: smeId.trim(), name: name.trim(), password, state, department });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
          <div className="w-full max-w-[400px] text-center">
            <div className="rounded-2xl border border-green-200 bg-green-50 px-8 py-10 shadow-sm">
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <FlaskConical className="h-7 w-7 text-green-600" />
                </div>
              </div>
              <h2 className="text-[20px] font-bold text-slate-900 mb-2">Registration Submitted</h2>
              <p className="text-[14px] text-slate-600 mb-6">
                Your SME account has been registered. A State Admin must approve your account before you can sign in.
              </p>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </button>
            </div>
          </div>
        </main>
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
        <div className="w-full max-w-[440px]">
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-1.5 text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
                <FlaskConical className="h-6 w-6 text-violet-600" />
              </div>
              <h1 className="text-[22px] font-bold text-slate-900">Register as SME</h1>
              <p className="mt-1 text-[14px] text-slate-500">
                Department expert & water authority registration
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] font-medium text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">SME ID</label>
                <div className="relative">
                  <FlaskConical className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={smeId}
                    onChange={(e) => setSmeId(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4`}
                    placeholder="Unique ID (e.g. SME001)"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4`}
                    placeholder="Your full name"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">State</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4 appearance-none`}
                  >
                    <option value="">Select your state</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Department</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4 appearance-none`}
                  >
                    <option value="">Select your department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-10`}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4`}
                    placeholder="Repeat password"
                  />
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
                    Registering…
                  </>
                ) : (
                  "Register"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
