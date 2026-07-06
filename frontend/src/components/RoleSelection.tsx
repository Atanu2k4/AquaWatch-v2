import React from "react";
import { Shield, UserCheck, Star, FlaskConical, ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export type AuthRole = "admin" | "l1" | "superadmin" | "sme";

interface RoleSelectionProps {
  onSelectRole: (role: AuthRole) => void;
}

const roles = [
  {
    role: "l1" as AuthRole,
    icon: UserCheck,
    title: "L1 Authority",
    badge: "Field Officer",
    description:
      "Verify, reject, or escalate incident reports for your assigned district.",
    color: "blue",
  },
  {
    role: "sme" as AuthRole,
    icon: FlaskConical,
    title: "SME / Authority",
    badge: "Department Expert",
    description:
      "Review routed incident reports and apply your domain expertise to resolve water incidents.",
    color: "violet",
  },
  {
    role: "admin" as AuthRole,
    icon: Shield,
    title: "State Admin",
    badge: "State Level",
    description:
      "Manage state-level incident assignments and control officer registrations.",
    color: "cyan",
  },
  {
    role: "superadmin" as AuthRole,
    icon: Star,
    title: "Super Admin",
    badge: "National Level",
    description:
      "National-level dashboard with India-wide water crisis maps and state aggregates.",
    color: "amber",
  },
];

const colorMap: Record<string, { bg: string; icon: string; badge: string }> = {
  blue: {
    bg: "bg-blue-50 group-hover:bg-blue-100",
    icon: "text-blue-600",
    badge: "bg-blue-50 text-blue-600 border-blue-100",
  },
  violet: {
    bg: "bg-violet-50 group-hover:bg-violet-100",
    icon: "text-violet-600",
    badge: "bg-violet-50 text-violet-600 border-violet-100",
  },
  cyan: {
    bg: "bg-cyan-50 group-hover:bg-cyan-100",
    icon: "text-cyan-600",
    badge: "bg-cyan-50 text-cyan-600 border-cyan-100",
  },
  amber: {
    bg: "bg-amber-50 group-hover:bg-amber-100",
    icon: "text-amber-600",
    badge: "bg-amber-50 text-amber-600 border-amber-100",
  },
};

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-theme-base selection:bg-theme-accent selection:text-theme-text">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          
          {/* Left - Logo */}
          <div className="flex flex-1 justify-start">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 focus:outline-none"
            >
              <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
              <span className="text-[15px] font-semibold text-slate-900">AquaWatch</span>
            </button>
          </div>

          {/* Center */}
          <span className="text-[14px] font-semibold text-slate-700">Auth Portal</span>

          {/* Right */}
          <div className="flex flex-1 justify-end">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-[14px] font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-16">
        {/* Heading */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5">
            <Shield className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Secure Portal
            </span>
          </div>
          <h1 className="mb-3 text-[32px] font-bold tracking-tight text-slate-900">
            Select your role
          </h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-slate-500">
            Choose your authorization level to securely access the AquaWatch
            platform.
          </p>
        </div>

        {/* Cards */}
        <div className="w-full max-w-3xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => {
              const c = colorMap[r.color];
              return (
                <button
                  key={r.role}
                  onClick={() => onSelectRole(r.role)}
                  className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  {/* Badge */}
                  <span
                    className={`mb-4 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${c.badge}`}
                  >
                    {r.badge}
                  </span>

                  {/* Icon */}
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${c.bg}`}
                  >
                    <r.icon className={`h-5 w-5 ${c.icon}`} />
                  </div>

                  <h3 className="mb-1.5 text-[17px] font-semibold text-slate-900">
                    {r.title}
                  </h3>
                  <p className="mb-5 flex-1 text-[13px] leading-relaxed text-slate-500">
                    {r.description}
                  </p>
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                    Sign in
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Citizen CTA */}
          <div className="mt-8 rounded-xl border border-slate-100 bg-white px-6 py-4">
            <p className="text-center text-[14px] text-slate-500">
              Citizen looking to report an incident?{" "}
              <button
                onClick={() => navigate("/report")}
                className="font-semibold text-blue-600 hover:underline"
              >
                Submit a report here →
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
