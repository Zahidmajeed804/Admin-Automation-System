import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

const TOKEN_KEY = "aas_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true); // resolving session on first load
  const [authError, setAuthError] = useState(null);

  const applySession = ({ user, token, roles, permissions }) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
    setRoles(roles || []);
    setPermissions(permissions || []);
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setRoles([]);
    setPermissions([]);
  };

  // On first mount, if a token exists, resolve the current user from it.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then((data) => applySession({ ...data, token }))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  // `identifier`: phone number, Employee ID or email.
  const login = useCallback(async (identifier, password) => {
    setAuthError(null);
    try {
      const data = await authService.login({ identifier, password });
      applySession(data);
      return { success: true };
    } catch (err) {
      const message = err?.response?.data?.message || "Login failed. Please try again.";
      setAuthError(message);
      return { success: false, message };
    }
  }, []);

  const register = useCallback(async (payload) => {
    setAuthError(null);
    try {
      const data = await authService.register(payload);
      applySession(data);
      return { success: true };
    } catch (err) {
      const message = err?.response?.data?.message || "Registration failed. Please try again.";
      const details = err?.response?.data?.details;
      setAuthError(message);
      return { success: false, message, details };
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, []);

  // Reusable authorization check throughout the app — components call
  // hasPermission("giveaways.create"), never check a role name directly.
  const hasPermission = useCallback(
    (permissionName) => permissions.includes(permissionName),
    [permissions]
  );

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        permissions,
        isAuthenticated,
        loading,
        authError,
        login,
        register,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
