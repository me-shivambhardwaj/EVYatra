"use client";
import { useState } from "react";
import { Menu, X, Zap, User, LogOut, ChevronDown, Bookmark, Car, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/auth/AuthModal";

const LINKS = [
  { label: "Chargers", href: "#chargers" },
  { label: "EV Cars", href: "#cars" },
  { label: "India Impact", href: "#impact" },
  { label: "Trip planner", href: "#trip-planner" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { user, isLoggedIn, login, logout } = useAuth();
  const toast = useToast();

  const handleAuthSuccess = (token: string, userData: typeof user, isSignUp: boolean) => {
    if (userData) {
      login(token, userData);
      toast(isSignUp ? `Welcome to EVYatra, ${userData.name}! JWT created.` : `Welcome back, ${userData.name}!`);
    }
  };

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    toast("You have been signed out.");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-transparent bg-mist/85 backdrop-blur">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Main">
          <a href="#top" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <Zap className="text-brand" size={22} strokeWidth={2.2} /> EVYatra
          </a>

          <ul className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-[15px] font-medium text-muted transition-colors hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            {isLoggedIn && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-2 pr-3.5 text-sm font-bold text-ink shadow-sm ring-1 ring-line transition-all hover:ring-brand/40"
                  aria-expanded={userDropdownOpen}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-black text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate">{user.name.split(" ")[0]}</span>
                  <ChevronDown size={14} className="text-muted" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-line z-50">
                    <div className="border-b border-line pb-2.5 px-2">
                      <p className="text-sm font-extrabold text-ink truncate">{user.name}</p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                      {user.city && (
                        <p className="mt-1 text-[11px] font-semibold text-brand">📍 {user.city}</p>
                      )}
                      {user.preferredCar && (
                        <p className="text-[11px] font-semibold text-slate-500">🏎️ {user.preferredCar}</p>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck size={12} /> JWT Authenticated
                      </div>
                    </div>

                    <ul className="py-1 text-xs font-semibold text-ink space-y-1">
                      <li>
                        <a
                          href="#cars"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-mist"
                        >
                          <Car size={14} className="text-brand" /> Browse Luxury EVs
                        </a>
                      </li>
                      <li>
                        <a
                          href="#chargers"
                          onClick={() => setUserDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-mist"
                        >
                          <Bookmark size={14} className="text-brand" /> Saved Stations
                        </a>
                      </li>
                    </ul>

                    <div className="border-t border-line pt-1 mt-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark shadow-sm"
              >
                Sign in / Sign up
              </button>
            )}

            <button
              className="rounded-xl p-2.5 text-ink md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label="Toggle menu"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile Nav */}
        {open && (
          <ul className="border-t border-line bg-white px-5 py-3 md:hidden space-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-base font-semibold text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-2 border-t border-line">
              {isLoggedIn && user ? (
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-brand" />
                    <span className="text-sm font-bold">{user.name}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setOpen(false);
                    setAuthModalOpen(true);
                  }}
                  className="w-full rounded-xl bg-ink py-3 text-center text-sm font-bold text-white"
                >
                  Sign In / Sign Up
                </button>
              )}
            </li>
          </ul>
        )}
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
