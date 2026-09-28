import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import LogoLoader from "../../components/common/LogoLoader";

// A warmer line under the welcome headline, varied by time of day rather than a static caption.
function greetingSubtitle() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning — let's get things done.";
  if (hour < 18) return "Good afternoon — good to see you.";
  return "Good evening — nice to have you back.";
}

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Plays the Folio3 welcome animation once, then navigates on - rather than navigating
  // immediately, so a successful login always gets this moment instead of just a blank beat
  // while the next page's own data loads.
  const [showWelcome, setShowWelcome] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);
    if (result.success) {
      setShowWelcome(true);
    } else {
      setError(result.message);
    }
  };

  if (showWelcome) {
    return (
      <LogoLoader
        label={user?.name ? `Welcome, ${user.name}!` : "Welcome!"}
        subtitle={greetingSubtitle()}
        onComplete={() => navigate(redirectTo, { replace: true })}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/folio3-logo.png" alt="Folio3" className="h-16 w-auto" />
          <div>
            <p className="text-page-title text-ink">Admin Automation System</p>
            <p className="text-body text-ink-muted mt-1">Sign in to manage administrative operations</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-card shadow-card p-6 flex flex-col gap-4"
        >
          {error && (
            <div className="bg-status-errorBg border border-red-200 text-status-error text-body rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Input
            label="Email"
            name="email"
            type="email"
            icon={Mail}
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            icon={Lock}
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-body text-ink-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-body text-primary hover:text-primary-dark">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full mt-1">
            Login
          </Button>
        </form>

        <p className="text-center text-body text-ink-muted">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:text-primary-dark">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
