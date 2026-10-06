import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Phone, IdCard } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Phone is required; email and Employee ID are optional (the API accepts "" for them).
  const [form, setForm] = useState({
    name: "",
    phone: "",
    employeeId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    const result = await register(form);
    setLoading(false);

    if (result.success) {
      navigate("/dashboard", { replace: true });
      return;
    }

    setError(result.message);
    if (result.details) {
      const errs = {};
      result.details.forEach((d) => {
        errs[d.field] = d.message;
      });
      setFieldErrors(errs);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/folio3-logo.png" alt="Folio3" className="h-20 w-auto" />
          <div>
            <p className="text-page-title text-ink">Create your account</p>
            <p className="text-body text-ink-muted mt-1">Fill in your details to get started</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-card shadow-card p-6 flex flex-col gap-4"
        >
          {error && (
            <div
              role="alert"
              className="bg-status-errorBg border border-red-200 text-status-error text-body rounded-md px-3 py-2"
            >
              {error}
            </div>
          )}

          <Input
            label="Name"
            name="name"
            icon={User}
            placeholder="Jane Doe"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
            required
          />
          <Input
            label="Phone"
            name="phone"
            id="register-phone"
            type="tel"
            icon={Phone}
            placeholder="0300 1234567"
            value={form.phone}
            onChange={handleChange}
            error={fieldErrors.phone}
            helperText="You can sign in with this number."
            required
            autoComplete="tel"
          />
          <Input
            label="Employee ID (optional)"
            name="employeeId"
            id="register-employee-id"
            icon={IdCard}
            placeholder="EMP-001"
            value={form.employeeId}
            onChange={handleChange}
            error={fieldErrors.employeeId}
            autoComplete="off"
          />
          <Input
            label="Email (optional)"
            name="email"
            id="register-email"
            type="email"
            icon={Mail}
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
            autoComplete="email"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            icon={Lock}
            placeholder="At least 8 characters"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            icon={Lock}
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={fieldErrors.confirmPassword}
            required
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} className="w-full mt-1">
            Register
          </Button>
        </form>

        <p className="text-center text-body text-ink-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:text-primary-dark">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
