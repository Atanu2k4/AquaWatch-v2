import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Bell,
  BarChart3,
  Lightbulb,
  User,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface HeaderProps {
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMobileMenuToggle,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userData, logout, isAdmin } = useAuth();

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/dashboard" },
    { id: "solutions", label: "Solutions", icon: Lightbulb, path: "/solutions" },
    { id: "alerts", label: "Alerts", icon: Bell, path: "/alerts" },
  ];

  const adminNavItems = [
    { id: "admin-dashboard", label: "Dashboard", icon: BarChart3, path: "/admin" },
    { id: "admin-users", label: "User Management", icon: Shield, path: "/admin/users" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isActive = (path: string) => {
    if (path === "/" || path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname === path;
  };

  const getUserDisplayInfo = () => {
    if (isAdmin && userData) {
      return {
        name: `Admin (${(userData as any).id || "Authority"})`,
        subtitle: "Administrator",
        icon: Shield,
      };
    } else if (userData) {
      return {
        name: (userData as any).name || (userData as any).email || "User",
        subtitle: (userData as any).state || "Authority Account",
        icon: User,
      };
    }
    // For unauthenticated citizens on the dashboard
    return null;
  };

  const userInfo = getUserDisplayInfo();

  return (
    <header className="sticky top-0 bg-white/70 backdrop-blur-xl border-b border-white/50 w-full z-50 shadow-sm transition-all duration-300">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => handleNavigation("/")}
          className="flex items-center space-x-2 focus:outline-none"
        >
          <img src="/aquawatch.png" alt="AquaWatch Logo" className="h-8 w-auto object-contain" />
          <span className="font-semibold text-ink-black text-[16px]">AquaWatch</span>
        </button>

        <div className="flex items-center space-x-6">
          <nav className="hidden md:flex items-center space-x-1">
            {(!isAdmin ? navItems : adminNavItems).map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={`px-4 py-2 rounded-[4px] text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-mist-gray text-primary-blue"
                      : "text-true-black hover:bg-mist-gray/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Menu / Authority Login */}
          <div className="hidden md:flex items-center">
            {userInfo ? (
              <div className="relative group">
                <button className="flex items-center space-x-2 px-3 py-2 rounded-[4px] hover:bg-mist-gray transition-colors">
                  <userInfo.icon className="h-4 w-4 text-primary-blue" />
                  <span className="text-[14px] font-medium text-ink-black">{userInfo.name}</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-paper-white border border-mist-gray rounded-[8px] shadow-sm-2 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-left text-red-600 hover:bg-mist-gray text-[14px]"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="text-[14px] font-medium text-true-black hover:bg-mist-gray px-4 py-2 rounded-[4px] transition-colors"
              >
                Authority Login
              </button>
            )}
          </div>

          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 text-true-black hover:bg-mist-gray rounded-[4px]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-mist-gray bg-paper-white px-6 py-4 space-y-4">
          <nav className="flex flex-col space-y-1">
            {(!isAdmin ? navItems : adminNavItems).map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full text-left px-4 py-3 rounded-[4px] text-[14px] font-medium transition-colors ${
                    active
                      ? "bg-mist-gray text-primary-blue"
                      : "text-true-black hover:bg-mist-gray/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-mist-gray pt-4">
            {userInfo ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-4 py-3 text-red-600 hover:bg-mist-gray rounded-[4px] text-[14px] font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="w-full text-left px-4 py-3 text-true-black hover:bg-mist-gray rounded-[4px] text-[14px] font-medium"
              >
                Authority Login
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
