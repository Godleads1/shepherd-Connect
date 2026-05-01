import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLogin } from "@workspace/api-client-react";
import { useLang, LANGUAGES, LangCode } from "@/contexts/language";
import { Mail, Lock, Loader2, Globe, ChevronDown } from "lucide-react";

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
        <div
          key={p.id}
          className="absolute text-white/10"
          style={{
            left: p.left,
            bottom: "-10%",
            fontSize: p.size,
            animation: `float-up ${p.duration} ${p.delay} linear infinite`,
          }}
        >
          ✝
        </div>
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
        style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.90)" }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.flag} {current.nativeName}</span>
        <ChevronDown className="w-3 h-3" style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-44 rounded-xl overflow-hidden z-50 shadow-xl"
          style={{ background: "rgba(23,37,84,0.95)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-all text-left"
              style={
                lang === l.code
                  ? { background: "rgba(245,158,11,0.25)", color: "#fbbf24" }
                  : { color: "rgba(255,255,255,0.80)" }
              }
              onMouseOver={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseOut={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              <span className="text-base">{l.flag}</span>
              <div>
                <p className="font-semibold">{l.nativeName}</p>
                {l.nativeName !== l.label && <p className="text-[10px] opacity-60">{l.label}</p>}
              </div>
              {lang === l.code && <span className="ml-auto text-amber-400">✓</span>}
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
      style={{ background: "linear-gradient(160deg, #172554 0%, #1e3a8a 50%, #1d4ed8 100%)" }}
    >
      <Particles />

      {/* Language picker — top right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguagePicker />
      </div>

      {/* Logo */}
      <div className="logo-enter flex flex-col items-center mb-6 z-10">
        <div
          className="logo-pulse w-28 h-28 rounded-full bg-white p-2 shadow-2xl"
          style={{ border: "3px solid rgba(255,255,255,0.6)" }}
        >
          <img
            src="/rccg-logo.png"
            alt="RCCG Logo"
            className="w-full h-full rounded-full object-contain"
            style={{ background: "transparent" }}
          />
        </div>
        <p className="mt-3 text-[10px] font-semibold tracking-[0.2em] uppercase text-amber-400 text-center max-w-xs">
          {t.rccgFull}
        </p>
      </div>

      {/* Title */}
      <div className="slide-up-delay-1 text-center mb-6 z-10">
        <h1
          style={{ fontFamily: "'Playfair Display', serif" }}
          className="text-4xl font-bold text-white leading-tight"
        >
          Shepherd Connect
        </h1>
        <p className="mt-1 text-sm text-amber-400 tracking-wide">{t.tagline}</p>
        <p className="mt-1 text-xs text-white/60 italic">{t.motto}</p>
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
                ? { background: "#f59e0b", color: "#172554", fontWeight: 700 }
                : { background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Glass Form Card */}
      <div
        className="slide-up-delay-3 glass w-full z-10"
        style={{ maxWidth: 420, borderRadius: 24, padding: 32 }}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              {...form.register("email")}
              type="email"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              data-testid="input-email"
              className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
            />
            {form.formState.errors.email && (
              <p className="text-amber-300 text-xs mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              {...form.register("password")}
              type="password"
              placeholder={t.passwordPlaceholder}
              autoComplete="current-password"
              data-testid="input-password"
              className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
            />
            {form.formState.errors.password && (
              <p className="text-amber-300 text-xs mt-1">{form.formState.errors.password.message}</p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-center text-sm text-red-300">{form.formState.errors.root.message}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            data-testid="button-login"
            disabled={loginMutation.isPending}
            className="w-full h-12 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
              color: "#172554",
              boxShadow: "0 4px 15px rgba(245,158,11,0.4)",
            }}
            onMouseOver={e => { if (!loginMutation.isPending) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)"; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
          >
            {loginMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t.opening}</>
            ) : (
              t.enterBtn
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-white/60">
          {t.newFamily}{" "}
          <Link href="/register">
            <span className="text-amber-400 font-medium hover:text-amber-300 cursor-pointer" data-testid="link-register">
              {t.registerHere}
            </span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="slide-up-delay-3 mt-8 text-xs text-white/30 z-10 text-center">
        {t.footer}
      </p>
    </div>
  );
}
