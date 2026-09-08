"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";

import {
  demoLoginAction,
  passwordLoginAction,
  resendOtpAction,
  startLoginAction,
  verifyOtpAction,
} from "@/app/[locale]/login/actions";

type Step =
  | { kind: "IDENTIFY" }
  | { kind: "PASSWORD"; employeeId: string; name: string }
  | { kind: "OTP"; email: string; devCode?: string };

const FEATURE_PILLS = [
  "Expands Product Offering",
  "Improves Risk Management",
  "Improves Cash Flow",
  "Provides Capital Relief",
  "Delivers Better Return on Equity",
  "Facilitates Securitization Transactions",
  "Co-lending",
];

/** The certifications and controls this workspace is run under — deliberately short labels, so
 *  the row stays one line on a laptop and wraps to two only on a narrow window. */
const SECURITY_BADGES = [
  { label: "ISO 27001", icon: <ShieldCheckIcon className="size-3.5" /> },
  { label: "SOC 2 Type II", icon: <BadgeCheckIcon className="size-3.5" /> },
  { label: "AES-256", icon: <LockIcon className="size-3.5" /> },
  { label: "MFA Enforced", icon: <KeyRoundIcon className="size-3.5" /> },
];

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-neutral-200 bg-white/80 pl-10 pr-10 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#f26e22] focus:bg-white focus:ring-2 focus:ring-[#f26e22]/20";

export function LoginClient({
  returnTo,
}: Readonly<{ returnTo?: string }>) {
  const [step, setStep] = useState<Step>({ kind: "IDENTIFY" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Focus the field for whichever step just became active — same effect as autoFocus,
  // without the accessibility footgun jsx-a11y/no-autofocus flags (a screen reader user
  // gets yanked to the field before hearing the label/instructions around it).
  useEffect(() => {
    if (step.kind === "PASSWORD") passwordInputRef.current?.focus();
    if (step.kind === "OTP") codeInputRef.current?.focus();
  }, [step.kind]);



  const reset = useCallback(() => {
    setStep({ kind: "IDENTIFY" });
    setPassword("");
    setCode("");
    setError(null);
    setNotice(null);
  }, []);

  const onIdentify = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        const result = await startLoginAction(identifier);
        if (result.mode === "ERROR") {
          setError(result.error);
          return;
        }
        if (result.mode === "PASSWORD") {
          setStep({
            kind: "PASSWORD",
            employeeId: result.employeeId,
            name: result.name,
          });
          return;
        }
        setStep({ kind: "OTP", email: result.email, devCode: result.devCode });
        setNotice(`A one-time code has been sent to ${result.email}.`);
      });
    },
    [identifier]
  );

  const onPassword = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (step.kind !== "PASSWORD") return;
      setError(null);
      const employeeId = step.employeeId;
      startTransition(async () => {
        const result = await passwordLoginAction(employeeId, password, returnTo);
        if (result?.error) setError(result.error);
      });
    },
    [step, password, returnTo]
  );

  const onVerify = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (step.kind !== "OTP") return;
      setError(null);
      const email = step.email;
      startTransition(async () => {
        const result = await verifyOtpAction(email, code, returnTo);
        if (result?.error) setError(result.error);
      });
    },
    [step, code, returnTo]
  );

  const onResend = useCallback(() => {
    if (step.kind !== "OTP") return;
    const email = step.email;
    setError(null);
    startTransition(async () => {
      const result = await resendOtpAction(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep({ kind: "OTP", email, devCode: result.devCode });
      setNotice(`A new code has been sent to ${email}.`);
    });
  }, [step]);

  const onDemo = useCallback((role: "IMGC" | "LENDER") => {
    setError(null);
    startTransition(async () => {
      const result = await demoLoginAction(role);
      if (result?.error) setError(result.error);
    });
  }, []);

  return (
    <div className="relative isolate h-dvh w-full overflow-hidden bg-[#fdf1e2] text-slate-800 subpixel-antialiased">
      {/* ── Backdrop ────────────────────────────────────────────────────
          The same looping video as before, under a warmer, more orange-led
          wash — still the same cream-to-orange family, just leaning further
          into the orange throughout instead of holding cream so long. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover [filter:brightness(1.12)_contrast(1.04)_saturate(1.05)]"
      >
        <source src="/assets/videos/login-bg.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(253,235,211,0.84)_0%,rgba(247,175,108,0.68)_32%,rgba(238,101,25,0.8)_100%)]"
      />

      <div className="relative z-10 mx-auto flex h-dvh w-full max-w-[1440px] flex-col overflow-y-auto px-6 py-4 lg:px-10 lg:py-5">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="imgc-rise flex items-start gap-4">
          <div className="flex items-center gap-3">
            {/* logo.png's own baked-in "IMGC / Defining Tomorrow" text was illegible at the
                previous 44px — the file is square (80×80), so sizing it up while keeping
                width===height (no stretching) is what actually fixes it, not swapping assets.
                A white card behind it (same idea as the sidebar's logo mount) is what actually
                gives it contrast against the warm cream/orange backdrop — the logo's own colors
                (orange mark, grey wordmark) read faintly straight on top of that gradient. */}
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-sm">
              <Image
                src="/assets/icons/logo.png"
                alt="IMGC"
                width={80}
                height={80}
                className="h-auto w-auto max-h-full max-w-full object-contain"
              />
            </div>
            <span className="leading-tight">
              <span className="block font-outfit text-[17px] font-bold tracking-tight text-slate-900">
                IMGC Lender Portal
              </span>
              {/* <span className="block text-[12px] text-slate-700">
                Initial Claims Platform
              </span> */}
            </span>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-6 py-4 lg:flex-row lg:items-center lg:gap-12 lg:py-2">
          {/* Left: the proposition */}
          <section className="imgc-rise min-w-0 flex-1">
            <h1 className="font-outfit max-w-[620px] text-[34px] font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-[44px]">
              One workspace{" "}
              <span className="text-[#d85811] [text-shadow:_0_0_15px_rgb(255_255_255_/_100%),_0_1px_2px_rgb(255_255_255_/_80%)]">
                for every lender.
              </span>
            </h1>
            <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-slate-800">
              Collect once, review everywhere — documents, PAS values and a
              complete audit trail on a single account.
            </p>

            <ul className="mt-5 flex max-w-[620px] flex-wrap gap-2">
              {FEATURE_PILLS.map((pill) => (
                <li
                  key={pill}
                  className="flex items-center gap-1.5 rounded-full border border-[#f26e22]/20 bg-white/60 px-3 py-1.5 text-[12px] font-medium text-slate-800"
                >
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-[#f26e22]" />
                  {pill}
                </li>
              ))}
            </ul>

            {/* Squarer chips with an icon tile, deliberately unlike the rounded-full benefit
                pills above — these are assurances about the platform, not things it does. */}
            <div className="mt-6 max-w-[560px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Security &amp; compliance
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {SECURITY_BADGES.map((badge) => (
                  <li
                    key={badge.label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/10 bg-white/80 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[#f26e22]/12 text-[#f26e22]">
                      {badge.icon}
                    </span>
                    {badge.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Right: sign-in card */}
          <section className="imgc-rise w-full shrink-0 lg:w-[420px]">
            <div className="rounded-2xl border border-white/60 bg-white/95 backdrop-blur-xl p-6 shadow-2xl shadow-[#f26e22]/25">
              <h2 className="font-outfit text-center text-[22px] font-bold tracking-tight text-slate-900">
                Welcome Back
              </h2>
              <p className="mt-1 mb-4 text-center text-[13px] text-slate-700">
                Sign in to your IMGC Lender Portal account
              </p>

              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-[12.5px] text-red-700"
                >
                  {error}
                </p>
              )}
              {!error && notice && (
                <p className="mb-4 rounded-lg border border-blue-500/30 bg-blue-50 px-3 py-2 text-[12.5px] text-blue-700">
                  {notice}
                </p>
              )}

              {step.kind === "IDENTIFY" && (
                <form onSubmit={onIdentify} noValidate>
                  <FieldLabel>Employee ID or Email</FieldLabel>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="EMP-0001  or  you@lender.com"
                      autoComplete="username"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
                    IMGC staff sign in with an Employee ID and password. Lender
                    users sign in with their work email — we send a one-time code.
                  </p>
                  <SubmitButton pending={pending} label="Continue" />
                </form>
              )}

              {step.kind === "PASSWORD" && (
                <form onSubmit={onPassword} noValidate>
                  <IdentityChip
                    icon={<UserIcon className="size-3.5" />}
                    text={`${step.name} · ${step.employeeId}`}
                    onChange={reset}
                  />
                  <FieldLabel>Password</FieldLabel>
                  <div className="relative">
                    <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className={INPUT_CLASS}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="size-4 accent-[#f37819]"
                      />
                      Remember me
                    </label>
                    <span className="text-[13px] font-medium text-slate-600">
                      Forgot password?
                    </span>
                  </div>

                  <SubmitButton pending={pending} label="Sign In" />
                </form>
              )}

              {step.kind === "OTP" && (
                <form onSubmit={onVerify} noValidate>
                  <IdentityChip
                    icon={<MailIcon className="size-3.5" />}
                    text={step.email}
                    onChange={reset}
                  />
                  <FieldLabel>One-time code</FieldLabel>
                  <input
                    ref={codeInputRef}
                    inputMode="numeric"
                    maxLength={6}
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    autoComplete="one-time-code"
                    className="h-12 w-full rounded-lg border border-neutral-200 bg-white/80 text-center font-mono text-[22px] tracking-[0.5em] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#f26e22] focus:bg-white focus:ring-2 focus:ring-[#f26e22]/20"
                  />
                  {step.devCode && (
                    <p className="mt-2 rounded-md border border-[#f26e22]/20 bg-orange-50 px-2.5 py-1.5 text-[11.5px] text-slate-700">
                      Development only — no mail is sent. Your code is{" "}
                      <span className="font-mono font-bold text-[#d85811]">
                        {step.devCode}
                      </span>
                      .
                    </p>
                  )}
                  <div className="mt-3 text-right">
                    <button
                      type="button"
                      onClick={onResend}
                      disabled={pending}
                      className="text-[12.5px] font-medium text-[#d85811] hover:text-[#f26e22] disabled:opacity-50"
                    >
                      Send a new code
                    </button>
                  </div>
                  <SubmitButton pending={pending} label="Verify & Sign In" />
                </form>
              )}

              <div className="mt-5 border-t border-[#f26e22]/20 pt-4 text-center">
                <p className="text-[12.5px] text-slate-600">
                  Need demo access?{" "}
                  <span className="font-semibold text-slate-900">
                    Enter Demo Mode
                  </span>
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDemo("IMGC")}
                    className="cursor-pointer rounded-lg border border-neutral-200 bg-white/50 px-3 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:border-[#f26e22]/50 hover:bg-white hover:text-[#f26e22] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Demo as IMGC
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDemo("LENDER")}
                    className="cursor-pointer rounded-lg border border-neutral-200 bg-white/50 px-3 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:border-[#f26e22]/50 hover:bg-white hover:text-[#f26e22] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Demo as Lender
                  </button>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-4 w-fit rounded-full bg-white/80 px-3 py-1 text-center text-[12px] text-slate-700 shadow-sm backdrop-blur-sm">
              Protected workspace · access is granted by IMGC
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({
  pending,
  label,
}: Readonly<{ pending: boolean; label: string }>) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f26e22] text-[14px] font-semibold text-white transition hover:bg-[#d85811] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
      {!pending && <ArrowRightIcon className="size-4" />}
    </button>
  );
}

function IdentityChip({
  icon,
  text,
  onChange,
}: Readonly<{ icon: React.ReactNode; text: string; onChange: () => void }>) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white/60 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-slate-800">
        <span className="text-slate-500">{icon}</span>
        <span className="truncate">{text}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-[12px] font-medium text-[#f26e22] hover:text-[#d85811]"
      >
        Change
      </button>
    </div>
  );
}
