import React, { useState } from "react";
import { type AuthRole, RoleSelection } from "./RoleSelection";
import { AdminLogin } from "./AdminLogin";
import { L1Login } from "./L1Login";
import { L1Register } from "./L1Register";
import { SuperAdminLogin } from "./SuperAdminLogin";

type AuthStep =
  | "role-selection"
  | "admin-login"
  | "l1-login"
  | "l1-register"
  | "superadmin-login";

interface AuthenticationProps {
  onSuccess: () => void;
}

export const Authentication: React.FC<AuthenticationProps> = ({ onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<AuthStep>("role-selection");

  const handleRoleSelection = (role: AuthRole) => {
    switch (role) {
      case "admin":      setCurrentStep("admin-login"); break;
      case "l1":         setCurrentStep("l1-login"); break;
      case "superadmin": setCurrentStep("superadmin-login"); break;
    }
  };

  const back = () => setCurrentStep("role-selection");

  switch (currentStep) {
    case "role-selection":
      return <RoleSelection onSelectRole={handleRoleSelection} />;

    case "admin-login":
      return <AdminLogin onBack={back} onSuccess={onSuccess} />;

    case "l1-login":
      return <L1Login onBack={back} onSuccess={onSuccess} onRegister={() => setCurrentStep("l1-register")} />;

    case "l1-register":
      return <L1Register onBack={() => setCurrentStep("l1-login")} />;

    case "superadmin-login":
      return <SuperAdminLogin onBack={back} onSuccess={onSuccess} />;

    default:
      return <RoleSelection onSelectRole={handleRoleSelection} />;
  }
};
