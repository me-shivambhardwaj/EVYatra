"use client";
import { useState } from "react";
import { X, Zap, Mail, Lock, User, Phone, MapPin, Car, ArrowRight, Loader2 } from "lucide-react";
import type { UserPayload } from "@/lib/auth";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: UserPayload, isSignUp: boolean) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Delhi NCR");
  const [preferredCar, setPreferredCar] = useState("Porsche Taycan");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { name, email, password, phone, city, preferredCar };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Authentication failed. Please check your inputs.");
        setLoading(false);
        return;
      }

      onSuccess(data.token, data.user, mode === "signup");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("rahul@evyatra.in");
    setPassword("password123");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-line z-10">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-soft to-brand-mint/40 p-6 pb-5 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/80 p-2 text-muted transition-colors hover:bg-white hover:text-ink"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <Zap size={20} strokeWidth={2.4} />
            </span>
            EVYatra Account
          </div>
          <p className="mt-2 text-xs text-muted">
            Sign in to save favourite luxury EVs, route plans, and station bookmarks with JWT security.
          </p>

          {/* Mode Tabs */}
          <div className="mt-4 flex rounded-xl bg-white/80 p-1 ring-1 ring-line">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                mode === "login"
                  ? "bg-ink text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                mode === "signup"
                  ? "bg-ink text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl bg-mist py-3 pl-10 pr-4 text-sm font-semibold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                    Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
                    <input
                      type="tel"
                      placeholder="+91 98765..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-2xl bg-mist py-3 pl-9 pr-3 text-xs font-semibold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                    City
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full appearance-none rounded-2xl bg-mist py-3 pl-9 pr-3 text-xs font-semibold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
                    >
                      <option>Delhi NCR</option>
                      <option>Mumbai</option>
                      <option>Bengaluru</option>
                      <option>Hyderabad</option>
                      <option>Chennai</option>
                      <option>Pune</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                  Preferred / Driven EV
                </label>
                <div className="relative">
                  <Car size={16} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="e.g. Porsche Taycan, Mercedes EQS"
                    value={preferredCar}
                    onChange={(e) => setPreferredCar(e.target.value)}
                    className="w-full rounded-2xl bg-mist py-3 pl-10 pr-4 text-sm font-semibold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-mist py-3 pl-10 pr-4 text-sm font-semibold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-muted pointer-events-none" />
              <input
                type="password"
                required
                placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-mist py-3 pl-10 pr-4 text-sm font-semibold text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === "login" ? (
              <>
                Sign In With JWT <ArrowRight size={16} />
              </>
            ) : (
              <>
                Create Account &amp; Get Token <ArrowRight size={16} />
              </>
            )}
          </button>

          {mode === "login" && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={fillDemo}
                className="text-xs font-semibold text-brand hover:underline"
              >
                ⚡ Click to fill demo credentials (rahul@evyatra.in)
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
