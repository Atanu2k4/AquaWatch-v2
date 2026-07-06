import React, { useState } from "react";
import { ArrowLeft, Star, Lock, Eye, EyeOff, Waves } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface SuperAdminLoginProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const SuperAdminLogin: React.FC<SuperAdminLoginProps> = ({ onBack, onSuccess }) => {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { superAdminLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await superAdminLogin(id.trim(), password);
      onSuccess();
    } catch {
      setError("Invalid Super Admin credentials.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-lg border border-slate-200 bg-white py-3 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors";

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
        <div className="w-full max-w-[400px]">
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-1.5 text-[14px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to roles
          </button>

          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <Star className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-[22px] font-bold text-slate-900">Super Admin</h1>
              <p className="mt-1 text-[14px] text-slate-500">Access the national overview dashboard</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] font-medium text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Super Admin ID</label>
                <div className="relative">
                  <Star className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    required
                    className={`${inputBase} pl-9 pr-4`}
                    placeholder="e.g. sa_national"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
