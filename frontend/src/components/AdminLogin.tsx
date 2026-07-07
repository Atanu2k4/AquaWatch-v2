import React, { useState } from "react";
import { ArrowLeft, Shield, Lock, Eye, EyeOff, Waves } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface AdminLoginProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onBack, onSuccess }) => {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { adminLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(id.trim(), password);
      onSuccess();
    } catch {
      setError("Invalid admin ID or password.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white py-3 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";

  return (
    <div className="min-h-screen bg-theme-base selection:bg-theme-accent selection:text-theme-text">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200">
        <div className="flex items-center h-full max-w-6xl px-6 mx-auto">
          <div className="flex items-center gap-2">
            <img src="/aquawatch.png" alt="AquaWatch Logo" className="object-contain w-auto h-8" />
            <span className="text-[15px] font-semibold text-slate-900">AquaWatch</span>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-1.5 text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to roles
          </button>

          <div className="px-8 py-10 bg-white border shadow-sm rounded-2xl border-slate-200">
            {/* Icon + title */}
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-xl bg-blue-50">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-[22px] font-bold text-slate-900">State Admin</h1>
              <p className="mt-1 text-[14px] text-slate-500">Sign in to manage state-level incidents</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] font-medium text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Admin ID</label>
                <div className="relative">
                  <Shield className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4`}
                    placeholder="e.g. admin001"
                  />
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
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -mt-2 flex items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-[14px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 rounded-full animate-spin border-white/30 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
