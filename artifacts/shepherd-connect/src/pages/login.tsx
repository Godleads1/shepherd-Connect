import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLogin } from "@workspace/api-client-react";
import { useLang, LANGUAGES, LangCode } from "@/contexts/language";
import { Mail, Lock, Loader2, Globe, ChevronDown } from "lucide-react";

// ── Brand palette derived from RCCG logo ──
const LOGO_NAVY  = "#1a237e"; // deep indigo — badge centre
const LOGO_GREEN = "#1b5e20"; // forest green — text ring

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

function Particles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + i * 8}%`,
    delay: `${i * 0.7}s`,
    duration: `${8 + (i % 4) * 2}s`,
    size: i % 3 === 0 ? 20 : i % 3 === 1 ? 14 : 10,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map(p => (
        <div key={p.id} className="absolute" style={{ left: p.left, bottom: "-10%", fontSize: p.size, color: "rgba(26,35,126,0.06)", animation: `float-up ${p.duration} ${p.delay} linear infinite` }}>✝</div>
      ))}
    </div>
  );
}

function LanguagePicker() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === lang)!;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{ background: "rgba(255,255,255,0.80)", color: LOGO_NAVY, border: `1px solid rgba(26,35,126,0.15)`, backdropFilter: "blur(8px)" }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.flag} {current.nativeName}</span>
        <ChevronDown className="w-3 h-3" style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl overflow-hidden z-50 shadow-xl" style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)", border: `1px solid rgba(26,35,126,0.12)` }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-all text-left"
              style={lang === l.code ? { background: `rgba(26,35,126,0.08)`, color: LOGO_NAVY } : { color: "#374151" }}
              onMouseOver={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = "rgba(26,35,126,0.04)"; }}
              onMouseOut={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              <span className="text-base">{l.flag}</span>
              <div>
                <p className="font-semibold">{l.nativeName}</p>
                {l.nativeName !== l.label && <p className="text-[10px] opacity-50">{l.label}</p>}
              </div>
              {lang === l.code && <span className="ml-auto" style={{ color: LOGO_GREEN }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: localLogin } = useAuth();
  const loginMutation = useLogin();
  const { t } = useLang();
  const [selectedRole, setSelectedRole] = useState("parent");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await loginMutation.mutateAsync({ data });
      localLogin(response.token, response.user);
      const role = response.user.role;
      if (role === "parent") setLocation("/my-family");
      else if (role === "teacher") setLocation("/my-class");
      else if (role === "attendant") setLocation("/checkin");
      else setLocation("/dashboard");
    } catch {
      form.setError("root", { message: t.invalidLogin });
    }
  };

  const rolePillItems = [
    { label: t.rolePills.parent,    value: "parent" },
    { label: t.rolePills.teacher,   value: "teacher" },
    { label: t.rolePills.admin,     value: "admin" },
    { label: t.rolePills.attendant, value: "attendant" },
  ];

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 20% 20%, #fde8d8 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #dbeafe 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, #fefcf9 0%, #f8fafc 100%)" }}
    >
      <Particles />

      {/* Language picker */}
      <div className="absolute top-4 right-4 z-20">
        <LanguagePicker />
      </div>

      {/* Logo — scale(1.18) zooms past the built-in padding so the seal fills edge-to-edge */}
      <div className="logo-enter flex flex-col items-center mb-6 z-10">
        <img
          src="/rccg-logo.png"
          alt="RCCG Logo"
          style={{ width: 200, height: 200, objectFit: "contain", display: "block" }}
        />
        <p className="mt-3 text-[10px] font-semibold tracking-[0.2em] uppercase text-center max-w-xs" style={{ color: LOGO_GREEN }}>
          {t.rccgFull}
        </p>
      </div>

      {/* Title */}
      <div className="slide-up-delay-1 text-center mb-6 z-10">
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0a0f1e" }} className="text-4xl font-bold leading-tight">
          Shepherd Connect
        </h1>
        <p className="mt-1 text-sm tracking-wide font-medium" style={{ color: LOGO_NAVY }}>{t.tagline}</p>
        <p className="mt-1 text-xs italic" style={{ color: "#64748b" }}>{t.motto}</p>
      </div>

      {/* Role Pills */}
      <div className="slide-up-delay-2 flex gap-2 mb-5 overflow-x-auto z-10 max-w-sm w-full justify-center flex-wrap">
        {rolePillItems.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelectedRole(r.value)}
            className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300"
            style={
              selectedRole === r.value
                ? { background: LOGO_NAVY, color: "#ffffff", fontWeight: 700, boxShadow: `0 2px 10px rgba(26,35,126,0.35)` }
                : { background: "rgba(255,255,255,0.75)", color: LOGO_NAVY, border: `1px solid rgba(26,35,126,0.18)` }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Form Card */}
      <div
        className="slide-up-delay-3 w-full z-10"
        style={{
          maxWidth: 420, borderRadius: 24, padding: 32,
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.92)",
          boxShadow: "0 8px 40px rgba(26,35,126,0.10)",
        }}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input
              {...form.register("email")}
              type="email"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              data-testid="input-email"
              className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
              onFocus={e => { e.currentTarget.style.borderColor = LOGO_NAVY; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(26,35,126,0.10)`; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(26,35,126,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {form.formState.errors.email && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{form.formState.errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
            <input
              {...form.register("password")}
              type="password"
              placeholder={t.passwordPlaceholder}
              autoComplete="current-password"
              data-testid="input-password"
              className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
              onFocus={e => { e.currentTarget.style.borderColor = LOGO_NAVY; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(26,35,126,0.10)`; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(26,35,126,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {form.formState.errors.password && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{form.formState.errors.password.message}</p>}
          </div>

          {form.formState.errors.root && (
            <p className="text-center text-sm" style={{ color: "#b91c1c" }}>{form.formState.errors.root.message}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            data-testid="button-login"
            disabled={loginMutation.isPending}
            className="w-full h-12 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: LOGO_NAVY, color: "#ffffff", boxShadow: `0 4px 16px rgba(26,35,126,0.28)`, letterSpacing: "0.02em" }}
            onMouseOver={e => { if (!loginMutation.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#283593"; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = LOGO_NAVY; }}
          >
            {loginMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.opening}</>
              : t.enterBtn}
          </button>
        </form>

        <div className="mt-5 text-center text-sm" style={{ color: "#64748b" }}>
          {t.newFamily}{" "}
          <Link href="/register">
            <span className="font-semibold cursor-pointer transition-opacity hover:opacity-75" style={{ color: LOGO_GREEN }} data-testid="link-register">
              {t.registerHere}
            </span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="slide-up-delay-3 mt-8 text-xs z-10 text-center" style={{ color: "#94a3b8" }}>
        {t.footer}
      </p>
    </div>
  );
}
