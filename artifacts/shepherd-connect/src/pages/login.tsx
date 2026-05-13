import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLogin } from "@workspace/api-client-react";
import { useLang, LANGUAGES, LangCode } from "@/contexts/language";
import { Mail, Lock, Loader2, Globe, ChevronDown, Eye, EyeOff, ShieldCheck, ArrowLeft, KeyRound, Copy, Check, RotateCcw } from "lucide-react";
import { apiPost } from "@/lib/api-call";

const LOGO_NAVY  = "#1a237e";
const LOGO_GREEN = "#1b5e20";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

function Particles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i, left: `${5 + i * 8}%`, delay: `${i * 0.7}s`,
    duration: `${8 + (i % 4) * 2}s`, size: i % 3 === 0 ? 20 : i % 3 === 1 ? 14 : 10,
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
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{ background: "rgba(255,255,255,0.80)", color: LOGO_NAVY, border: `1px solid rgba(26,35,126,0.15)`, backdropFilter: "blur(8px)" }}>
        <Globe className="w-3.5 h-3.5" />
        <span>{current.flag} {current.nativeName}</span>
        <ChevronDown className="w-3 h-3" style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl overflow-hidden z-50 shadow-xl"
          style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)", border: `1px solid rgba(26,35,126,0.12)` }}>
          {LANGUAGES.map(l => (
            <button key={l.code} type="button" onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-all text-left"
              style={lang === l.code ? { background: `rgba(26,35,126,0.08)`, color: LOGO_NAVY } : { color: "#374151" }}
              onMouseOver={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = "rgba(26,35,126,0.04)"; }}
              onMouseOut={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = ""; }}>
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
  const [showPw, setShowPw] = useState(false);

  // MFA second step
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");

  // Forgot password flow
  const [forgotStep, setForgotStep] = useState<"off" | "request" | "reset">("off");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotResetCode, setForgotResetCode] = useState(""); // code returned from API
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotConfirmPw, setForgotConfirmPw] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

  const handleForgotRequest = async () => {
    if (!forgotEmail.trim()) { setForgotError("Please enter your email address."); return; }
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await apiPost<any>("/auth/forgot-password", { email: forgotEmail.trim() });
      if (res.code) {
        setForgotResetCode(res.code);
        setForgotStep("reset");
      } else {
        setForgotError("No account found with that email address.");
      }
    } catch (e: any) {
      setForgotError(e.message || "Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotReset = async () => {
    if (forgotNewPw.length < 6) { setForgotError("Password must be at least 6 characters."); return; }
    if (forgotNewPw !== forgotConfirmPw) { setForgotError("Passwords do not match."); return; }
    if (!forgotCode.trim()) { setForgotError("Please enter the reset code."); return; }
    setForgotLoading(true);
    setForgotError("");
    try {
      await apiPost<any>("/auth/reset-password", { email: forgotEmail.trim(), code: forgotCode.trim(), newPassword: forgotNewPw });
      setForgotSuccess(true);
    } catch (e: any) {
      setForgotError(e.message || "Invalid or expired code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotFlow = () => {
    setForgotStep("off");
    setForgotEmail("");
    setForgotCode("");
    setForgotResetCode("");
    setForgotNewPw("");
    setForgotConfirmPw("");
    setForgotError("");
    setForgotSuccess(false);
    setCodeCopied(false);
  };

  // Role picker step (multi-role users)
  const [rolePickStep, setRolePickStep] = useState(false);
  const [rolePickOptions, setRolePickOptions] = useState<string[]>([]);
  const [rolePickFirstName, setRolePickFirstName] = useState("");
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const roleMatchesTab = (userRole: string, tab: string): boolean => {
    if (tab === "admin") return userRole === "admin" || userRole === "super_admin";
    return userRole === tab;
  };

  const tabLabel: Record<string, string> = {
    parent: "Parent",
    teacher: "Teacher",
    admin: "Admin",
    attendant: "Attendant",
  };

  const navigateForRole = (role: string) => {
    if (role === "parent") setLocation("/my-family");
    else if (role === "teacher") setLocation("/my-class");
    else if (role === "attendant") setLocation("/checkin");
    else setLocation("/dashboard");
  };

  const completeLoginWithRole = async (requestedRole: string, creds: { email: string; password: string }) => {
    try {
      const response = await loginMutation.mutateAsync({ data: { ...creds, requestedRole } as any }) as any;
      localLogin(response.token, response.user);
      navigateForRole(response.user.role);
    } catch {
      form.setError("root", { message: t.invalidLogin });
      setRolePickStep(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const response = await loginMutation.mutateAsync({ data }) as any;

      if (response.requiresMfa) {
        setMfaToken(response.mfaToken);
        setMfaStep(true);
        return;
      }

      // Multi-role: show picker
      if (response.requiresRolePick) {
        setRolePickOptions(response.allRoles);
        setRolePickFirstName(response.firstName);
        setPendingCredentials({ email: data.email, password: data.password });
        setRolePickStep(true);
        return;
      }

      if (!roleMatchesTab(response.user.role, selectedRole)) {
        // Check if the role is in their secondary roles — then allow it
        const allRoles: string[] = response.user.allRoles ?? [response.user.role];
        const tabRole = selectedRole === "admin" ? ["admin", "super_admin"] : [selectedRole];
        const hasAccess = allRoles.some(r => tabRole.includes(r));
        if (!hasAccess) {
          const correct = response.user.role === "super_admin" ? "admin" : response.user.role;
          form.setError("root", {
            message: `These credentials belong to a ${tabLabel[correct] ?? response.user.role} account. Please select the correct portal above.`,
          });
          return;
        }
      }

      localLogin(response.token, response.user);
      navigateForRole(response.user.role);
    } catch {
      form.setError("root", { message: t.invalidLogin });
    }
  };

  const handleMfaVerify = async () => {
    if (totpCode.length < 6) return;
    setMfaLoading(true);
    setMfaError("");
    try {
      const response = await apiPost<any>("/auth/mfa/verify-login", { mfaToken, totpCode });
      if (!roleMatchesTab(response.user.role, selectedRole)) {
        const correct = response.user.role === "super_admin" ? "admin" : response.user.role;
        setMfaError(`These credentials belong to a ${tabLabel[correct] ?? response.user.role} account. Please go back and select the correct portal.`);
        return;
      }
      localLogin(response.token, response.user);
      const role = response.user.role;
      if (role === "parent") setLocation("/my-family");
      else if (role === "teacher") setLocation("/my-class");
      else if (role === "attendant") setLocation("/checkin");
      else setLocation("/dashboard");
    } catch (e: any) {
      setMfaError(e.message || "Invalid code. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  const rolePillItems = [
    { label: t.rolePills.parent, value: "parent" },
    { label: t.rolePills.teacher, value: "teacher" },
    { label: t.rolePills.admin, value: "admin" },
    { label: t.rolePills.attendant, value: "attendant" },
  ];

  const cardStyle = {
    maxWidth: 420, borderRadius: 24, padding: 32,
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.92)",
    boxShadow: "0 8px 40px rgba(26,35,126,0.10)",
  };

  const roleLabels: Record<string, string> = {
    parent: "Parent",
    teacher: "Teacher",
    admin: "Admin",
    super_admin: "Super Admin",
    attendant: "Attendant",
  };

  const roleIcons: Record<string, string> = {
    parent: "👨‍👩‍👧",
    teacher: "📚",
    admin: "🛡️",
    super_admin: "⚡",
    attendant: "🎫",
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 20% 20%, #fde8d8 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #dbeafe 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, #fefcf9 0%, #f8fafc 100%)" }}>
      <Particles />

      <div className="absolute top-4 right-4 z-20"><LanguagePicker /></div>

      <div className="logo-enter flex flex-col items-center mb-2 z-10">
        <div className="rccg-logo-wrap" style={{ width: 140, height: 140, marginBottom: 16 }}>
          <img src="/rccg-logo-new.png" alt="RCCG Logo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        </div>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-center max-w-xs" style={{ color: LOGO_GREEN }}>
          {t.rccgFull}
        </p>
      </div>

      <div className="slide-up-delay-1 text-center mb-6 z-10">
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0a0f1e" }} className="text-4xl font-bold leading-tight">
          Shepherd Connect
        </h1>
        <p className="mt-1 text-sm tracking-wide font-medium" style={{ color: LOGO_NAVY }}>{t.tagline}</p>
        <p className="mt-1 text-xs italic" style={{ color: "#64748b" }}>{t.motto}</p>
      </div>

      {forgotStep !== "off" ? (
        /* ── Forgot Password flow ── */
        <div className="slide-up-delay-3 w-full z-10" style={cardStyle}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              {forgotStep === "request" ? "Reset Your Password" : "Set New Password"}
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              {forgotStep === "request"
                ? "Enter your registered email to receive a reset code."
                : "Copy the code below, then enter it with your new password."}
            </p>
          </div>

          {forgotSuccess ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-base font-semibold text-gray-800">Password Updated!</p>
              <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
              <button
                onClick={resetForgotFlow}
                className="w-full h-11 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2"
                style={{ background: LOGO_NAVY, color: "#ffffff" }}>
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </div>
          ) : forgotStep === "request" ? (
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setForgotError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleForgotRequest(); }}
                  autoFocus
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
                />
              </div>
              {forgotError && <p className="text-sm text-red-600 text-center">{forgotError}</p>}
              <button
                onClick={handleForgotRequest}
                disabled={forgotLoading}
                className="w-full h-11 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: LOGO_NAVY, color: "#ffffff", boxShadow: `0 4px 16px rgba(26,35,126,0.28)` }}>
                {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating code...</> : "Generate Reset Code"}
              </button>
              <button onClick={resetForgotFlow} className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Reset code display */}
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.30)" }}>
                <p className="text-xs font-semibold text-amber-700 mb-1 uppercase tracking-wide">Your Reset Code</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-amber-800 my-1">{forgotResetCode}</p>
                <p className="text-[10px] text-amber-600 mb-2">Valid for 15 minutes. Store it safely.</p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(forgotResetCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#92400e" }}>
                  {codeCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Code</>}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1 uppercase tracking-wide">Reset Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={forgotCode}
                    onChange={e => { setForgotCode(e.target.value.replace(/\D/g, "")); setForgotError(""); }}
                    className="w-full rounded-xl px-4 py-3 text-sm font-mono text-center tracking-widest focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showForgotPw ? "text" : "password"}
                    placeholder="New password (min 6 chars)"
                    value={forgotNewPw}
                    onChange={e => { setForgotNewPw(e.target.value); setForgotError(""); }}
                    className="w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
                  />
                  <button type="button" onClick={() => setShowForgotPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showForgotPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={forgotConfirmPw}
                    onChange={e => { setForgotConfirmPw(e.target.value); setForgotError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleForgotReset(); }}
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
                  />
                </div>
              </div>

              {forgotError && <p className="text-sm text-red-600 text-center">{forgotError}</p>}

              <button
                onClick={handleForgotReset}
                disabled={forgotLoading}
                className="w-full h-11 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: LOGO_NAVY, color: "#ffffff", boxShadow: `0 4px 16px rgba(26,35,126,0.28)` }}>
                {forgotLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : <><KeyRound className="w-4 h-4" /> Reset Password</>}
              </button>

              <div className="flex gap-2">
                <button onClick={() => setForgotStep("request")} className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-2 transition-colors">
                  <RotateCcw className="w-3 h-3" /> New code
                </button>
                <button onClick={resetForgotFlow} className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-2 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      ) : rolePickStep ? (
        /* ── Role picker step ── */
        <div className="slide-up-delay-3 w-full z-10" style={cardStyle}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4 text-3xl">
              👋
            </div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Welcome, {rolePickFirstName}!
            </h2>
            <p className="text-sm text-gray-500 mt-2">You have access to multiple roles. Which would you like to sign in as?</p>
          </div>
          <div className="space-y-2">
            {rolePickOptions.map(r => (
              <button key={r}
                onClick={() => pendingCredentials && completeLoginWithRole(r, pendingCredentials)}
                disabled={loginMutation.isPending}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border text-left font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #1a237e, #1565c0)", color: "white", borderColor: "transparent" }}>
                <span className="text-2xl">{roleIcons[r] ?? "👤"}</span>
                <div>
                  <p className="font-bold">{roleLabels[r] ?? r}</p>
                  <p className="text-xs opacity-70">Sign in as {roleLabels[r]}</p>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { setRolePickStep(false); setPendingCredentials(null); }}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-3 mt-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </button>
        </div>
      ) : !mfaStep ? (
        <>
          <div className="slide-up-delay-2 flex gap-2 mb-5 overflow-x-auto z-10 max-w-sm w-full justify-center flex-wrap">
            {rolePillItems.map(r => (
              <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300"
                style={selectedRole === r.value
                  ? { background: LOGO_NAVY, color: "#ffffff", fontWeight: 700, boxShadow: `0 2px 10px rgba(26,35,126,0.35)` }
                  : { background: "rgba(255,255,255,0.75)", color: LOGO_NAVY, border: `1px solid rgba(26,35,126,0.18)` }}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="slide-up-delay-3 w-full z-10" style={cardStyle}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
                <input {...form.register("email")} type="email" placeholder={t.emailPlaceholder} autoComplete="email" data-testid="input-email"
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
                  onFocus={e => { e.currentTarget.style.borderColor = LOGO_NAVY; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(26,35,126,0.10)`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(26,35,126,0.14)"; e.currentTarget.style.boxShadow = "none"; }} />
                {form.formState.errors.email && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{form.formState.errors.email.message}</p>}
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} />
                <input {...form.register("password")} type={showPw ? "text" : "password"} placeholder={t.passwordPlaceholder} autoComplete="current-password" data-testid="input-password"
                  className="w-full rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a" }}
                  onFocus={e => { e.currentTarget.style.borderColor = LOGO_NAVY; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(26,35,126,0.10)`; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(26,35,126,0.14)"; e.currentTarget.style.boxShadow = "none"; }} />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {form.formState.errors.password && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{form.formState.errors.password.message}</p>}
              </div>

              {form.formState.errors.root && (
                <p className="text-center text-sm" style={{ color: "#b91c1c" }}>{form.formState.errors.root.message}</p>
              )}

              <button type="submit" data-testid="button-login" disabled={loginMutation.isPending}
                className="w-full h-12 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: LOGO_NAVY, color: "#ffffff", boxShadow: `0 4px 16px rgba(26,35,126,0.28)`, letterSpacing: "0.02em" }}
                onMouseOver={e => { if (!loginMutation.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#283593"; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = LOGO_NAVY; }}>
                {loginMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.opening}</> : t.enterBtn}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setForgotStep("request")}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: LOGO_NAVY }}>
                Forgot your password?
              </button>
            </div>

            <div className="mt-3 text-center text-sm" style={{ color: "#64748b" }}>
              {t.newFamily}{" "}
              <Link href="/register">
                <span className="font-semibold cursor-pointer transition-opacity hover:opacity-75" style={{ color: LOGO_GREEN }} data-testid="link-register">
                  {t.registerHere}
                </span>
              </Link>
            </div>
          </div>
        </>
      ) : (
        /* ── MFA step ── */
        <div className="slide-up-delay-3 w-full z-10" style={cardStyle}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-blue-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Two-Factor Verification</h2>
            <p className="text-sm text-gray-500 mt-2">Open your authenticator app and enter the 6-digit code for Shepherd Connect.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2 uppercase tracking-wide">Authenticator Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, "")); setMfaError(""); }}
                placeholder="000000"
                className="w-full rounded-xl text-center text-3xl font-mono tracking-widest py-4 focus:outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.90)", border: `1.5px solid rgba(26,35,126,0.14)`, color: "#0f172a", letterSpacing: "0.25em" }}
                onKeyDown={e => { if (e.key === "Enter" && totpCode.length === 6) handleMfaVerify(); }}
                autoFocus
              />
            </div>

            {mfaError && <p className="text-sm text-red-600 text-center font-medium">{mfaError}</p>}

            <button onClick={handleMfaVerify} disabled={totpCode.length < 6 || mfaLoading}
              className="w-full h-12 rounded-full font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: LOGO_NAVY, color: "#ffffff", boxShadow: `0 4px 16px rgba(26,35,126,0.28)` }}>
              {mfaLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><ShieldCheck className="w-4 h-4" /> Verify &amp; Sign In</>}
            </button>

            <button onClick={() => { setMfaStep(false); setTotpCode(""); setMfaError(""); }}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </button>
          </div>

          <p className="text-xs text-center text-gray-400 mt-4">Code refreshes every 30 seconds. Use Google Authenticator, Authy, or similar.</p>
        </div>
      )}

      <p className="slide-up-delay-3 mt-8 text-xs z-10 text-center" style={{ color: "#94a3b8" }}>{t.footer}</p>
    </div>
  );
}
