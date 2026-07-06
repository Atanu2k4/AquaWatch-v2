import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, UserCog, User, LogOut, Check, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../utils/api";

export const UserDatabase: React.FC = () => {
  const navigate = useNavigate();
  const { userData, logout, isAdmin } = useAuth();
  
  const adminId = (userData as any)?.id ?? "";
  const adminPassword = (userData as any)?.password ?? "";

  const [authorities, setAuthorities] = useState<api.PendingL1[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadAuthorities = async () => {
    setLoading(true);
    try {
      const res = await api.getAllL1(adminId, adminPassword);
      setAuthorities(res.authorities || []);
      setMessage(null);
    } catch (err: any) {
      setMessage({ ok: false, text: "Failed to load L1 authorities." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && adminId && adminPassword) {
      loadAuthorities();
    }
  }, [isAdmin, adminId, adminPassword]);

  const handleStatusChange = async (govtId: string, newStatus: string) => {
    setUpdatingId(govtId);
    try {
      await api.updateL1Status(adminId, govtId, adminPassword, newStatus);
      setMessage({ ok: true, text: `Status updated for ${govtId}.` });
      setAuthorities(prev => 
        prev.map(a => a.govt_id === govtId ? { ...a, status: newStatus } : a)
      );
    } catch (err: any) {
      setMessage({ ok: false, text: `Failed to update status for ${govtId}.` });
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-theme-base flex items-center justify-center selection:bg-theme-accent selection:text-theme-text">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col items-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
          <p className="text-red-700 font-semibold">Access denied. State Admin privileges required.</p>
        </div>
      </div>
    );
  }

  // Filter out pending authorities, only show registered (approved/active/leave/retired)
  const registeredAuthorities = authorities.filter(a => a.status !== "pending");

  return (
    <div className="min-h-screen bg-theme-base font-sans text-theme-text selection:bg-theme-accent selection:text-theme-text">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex flex-1 justify-start">
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-semibold">Back to Dashboard</span>
            </button>
          </div>
          <span className="text-[14px] font-semibold text-slate-700">L1 Management</span>
          <div className="flex flex-1 items-center justify-end gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                loadAuthorities().then(() => setRefreshing(false));
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

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5">
            <Shield className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Admin Portal
            </span>
          </div>
          <h1 className="mb-3 text-[28px] font-bold tracking-tight text-slate-900">
            L1 Authority Management
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-slate-500">
            Manage registered field officers, view their assignments, and update their operational status.
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

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-theme-base px-6 py-4 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
              <UserCog className="h-4 w-4 text-blue-600" />
              Registered Users ({registeredAuthorities.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
                <span className="text-[13px] text-slate-500">Loading authorities...</span>
              </div>
            </div>
          ) : registeredAuthorities.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-[15px] font-medium text-slate-900">No registered authorities</p>
              <p className="mt-1 text-[14px] text-slate-500">Approved L1 authorities will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-900">Officer Name</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Govt ID</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">District</th>
                    <th className="px-6 py-3 font-semibold text-slate-900">Registered On</th>
                    <th className="px-6 py-3 font-semibold text-slate-900 text-center">Status Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registeredAuthorities.map((auth) => (
                    <tr key={auth._id} className="transition-colors hover:bg-theme-base/50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                            <User className="h-4 w-4" />
                          </div>
                          {auth.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-[13px]">
                        {auth.govt_id}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {auth.assigned_location.district}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(auth.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <select
                            value={auth.status}
                            disabled={updatingId === auth.govt_id}
                            onChange={(e) => handleStatusChange(auth.govt_id, e.target.value)}
                            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium outline-none transition-colors disabled:opacity-50 ${
                              auth.status === "active" || auth.status === "approved"
                                ? "border-green-200 bg-green-50 text-green-700 focus:border-green-300"
                                : auth.status === "leave"
                                ? "border-yellow-200 bg-yellow-50 text-yellow-700 focus:border-yellow-300"
                                : "border-slate-200 bg-theme-base text-slate-700 focus:border-slate-300"
                            }`}
                          >
                            <option value="approved">Active</option>
                            <option value="active">Active</option>
                            <option value="leave">On Leave</option>
                            <option value="retired">Retired</option>
                          </select>
                          {updatingId === auth.govt_id && (
                            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
