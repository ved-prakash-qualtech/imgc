/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop */
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { useServerErrorMessage } from "@/lib/serverErrorMessage";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step =
  | { kind: "IDENTIFY" }
  | { kind: "PASSWORD"; employeeId: string; name: string }
  | { kind: "OTP"; email: string; devCode?: string };

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
    <label className="mb-2 block text-ui-subhead-lg font-medium text-slate-700">
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-neutral-200/80 bg-white/90 pl-10 pr-10 text-ui-lead text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-brand-primary/10 hover:border-neutral-300 shadow-sm";

export function LoginClient({ returnTo }: Readonly<{ returnTo?: string }>) {
  const t = useTranslations("login");
  const errorText = useServerErrorMessage();
  const [step, setStep] = useState<Step>({ kind: "IDENTIFY" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Focus the field for whichever step just became active — same effect as autoFocus,
  // without the accessibility footgun jsx-a11y/no-autofocus flags (a screen reader user
  // gets yanked to the field before hearing the label/instructions around it).
  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- the step changes from
     several places (submit, back, a failed code), so focusing here keeps that in one place
     instead of repeating it in every handler. */
  useEffect(() => {
    if (step.kind === "PASSWORD") passwordInputRef.current?.focus();
    if (step.kind === "OTP") codeInputRef.current?.focus();
  }, [step.kind]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

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
          setError(errorText(result));
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
        setNotice(t("codeSentTo", { email: result.email }));
      });
    },
    [identifier, errorText, t]
  );

  const onPassword = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (step.kind !== "PASSWORD") return;
      setError(null);
      const employeeId = step.employeeId;
      startTransition(async () => {
        const result = await passwordLoginAction(
          employeeId,
          password,
          returnTo
        );
        setError(errorText(result));
      });
    },
    [step, password, returnTo, errorText]
  );

  const onVerify = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (step.kind !== "OTP") return;
      setError(null);
      const email = step.email;
      startTransition(async () => {
        const result = await verifyOtpAction(email, code, returnTo);
        setError(errorText(result));
      });
    },
    [step, code, returnTo, errorText]
  );

  const onResend = useCallback(() => {
    if (step.kind !== "OTP") return;
    const email = step.email;
    setError(null);
    startTransition(async () => {
      const result = await resendOtpAction(email);
      const message = errorText(result);
      if (message) {
        setError(message);
        return;
      }
      setStep({ kind: "OTP", email, devCode: result.devCode });
      setNotice(t("newCodeSentTo", { email }));
    });
  }, [step, errorText, t]);

  const onDemo = useCallback(
    (role: "IMGC" | "LENDER") => {
      setDemoModalOpen(false);
      setError(null);
      startTransition(async () => {
        const result = await demoLoginAction(role);
        setError(errorText(result));
      });
    },
    [errorText]
  );

  return (
    <div className="relative isolate h-dvh w-full overflow-hidden bg-[var(--surface-login)] text-slate-800 subpixel-antialiased">
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
        className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--grad-login-wash)]"
      />

      <div className="relative z-10 mx-auto flex h-dvh w-full max-w-[1440px] flex-col overflow-hidden px-6 py-3 lg:px-10 lg:py-4">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="imgc-rise flex items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-sm">
              <Image
                src="/assets/icons/logo.png"
                alt={t("logoAlt")}
                width={64}
                height={64}
                className="h-auto w-auto max-h-full max-w-full object-contain"
              />
            </div>
            <span className="leading-tight">
              <span className="block font-outfit text-ui-heading font-bold tracking-tight text-slate-900">
                {t("portalName")}
              </span>
              {/* <span className="block text-ui-body text-slate-700">
                Initial Claims Platform
              </span> */}
            </span>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-4 py-2 lg:flex-row lg:items-center lg:gap-10 lg:py-0 lg:-mt-3">
          {/* Left: the proposition */}
          <section className="imgc-rise flex min-w-0 flex-1 flex-col justify-between self-stretch py-2 lg:py-6">
            <div className="my-auto">
              <h1 className="font-outfit max-w-[620px] text-ui-hero-sm font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-ui-hero">
                {t("heroLead")}{" "}
                <span className="text-brand-dark [text-shadow:_0_0_15px_var(--glow-white),_0_1px_2px_var(--glow-white-soft)]">
                  {t("heroAccent")}
                </span>
              </h1>
              <p className="font-outfit mt-4 max-w-[560px] text-ui-display-lg font-semibold leading-snug tracking-tight text-slate-800">
                {t("heroSub")}
              </p>
            </div>

            {/* Squarer chips with an icon tile, deliberately unlike the rounded-full benefit
                pills above — these are assurances about the platform, not things it does. */}
            <div className="mt-6 lg:mt-auto pt-2 max-w-[560px]">
              <p className="text-ui-body font-bold uppercase tracking-[0.15em] text-slate-800">
                {t("securityHeading")}
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2.5">
                {SECURITY_BADGES.map((badge) => (
                  <li
                    key={badge.label}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-ui-subhead font-semibold text-slate-800 shadow-sm backdrop-blur-md"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white shadow-sm text-brand-primary">
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
            <div className="rounded-2xl border border-white/80 bg-white/90 backdrop-blur-2xl p-6 shadow-2xl shadow-black/5 sm:p-7">
              <h2 className="font-outfit text-center text-ui-display-lg font-bold tracking-tight text-slate-900">
                {t("welcomeBack")}
              </h2>
              <p className="mt-1 mb-4 text-center text-ui-subhead text-slate-500">
                {t("welcomeSub")}
              </p>

              {notice && (
                <p className="mb-3 text-ui-subhead font-medium text-blue-600">
                  {notice}
                </p>
              )}

              {step.kind === "IDENTIFY" && (
                <form onSubmit={onIdentify} noValidate>
                  <FieldLabel>{t("identifierLabel")}</FieldLabel>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t("identifierPlaceholder")}
                      autoComplete="username"
                      className={INPUT_CLASS}
                    />
                  </div>
                  {error && (
                    <p
                      role="alert"
                      className="mt-2 text-ui-subhead font-medium text-red-600"
                    >
                      {error}
                    </p>
                  )}
                  <p className="mt-3 text-ui-body-lg leading-relaxed text-slate-500">
                    {t("identifierHelp")}
                  </p>
                  <SubmitButton pending={pending} label={t("continue")} />
                </form>
              )}

              {step.kind === "PASSWORD" && (
                <form onSubmit={onPassword} noValidate>
                  <IdentityChip
                    icon={<UserIcon className="size-3.5" />}
                    text={`${step.name} · ${step.employeeId}`}
                    onChange={reset}
                  />
                  <FieldLabel>{t("passwordLabel")}</FieldLabel>
                  <div className="relative">
                    <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      autoComplete="current-password"
                      className={INPUT_CLASS}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? t("hidePassword") : t("showPassword")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p
                      role="alert"
                      className="mt-2 text-ui-subhead font-medium text-red-600"
                    >
                      {error}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2.5 text-ui-subhead-lg font-medium text-slate-700 hover:text-slate-900 transition-colors">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="size-4 rounded border-slate-300 accent-brand-primary transition-all hover:accent-brand-dark"
                      />
                      {t("rememberMe")}
                    </label>
                    <button
                      type="button"
                      className="text-ui-subhead-lg font-semibold text-brand-primary hover:text-brand-dark transition-colors"
                    >
                      {t("forgotPassword")}
                    </button>
                  </div>

                  <SubmitButton pending={pending} label={t("signIn")} />
                </form>
              )}

              {step.kind === "OTP" && (
                <form onSubmit={onVerify} noValidate>
                  <IdentityChip
                    icon={<MailIcon className="size-3.5" />}
                    text={step.email}
                    onChange={reset}
                  />
                  <FieldLabel>{t("otpLabel")}</FieldLabel>
                  <input
                    ref={codeInputRef}
                    inputMode="numeric"
                    maxLength={6}
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    autoComplete="one-time-code"
                    className="h-11 w-full rounded-xl border border-neutral-200/80 bg-white/90 text-center font-mono text-ui-display tracking-[0.4em] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-brand-primary/10 hover:border-neutral-300 shadow-sm"
                  />
                  {error && (
                    <p
                      role="alert"
                      className="mt-1 text-ui-subhead font-medium text-red-600"
                    >
                      {error}
                    </p>
                  )}
                  {step.devCode && (
                    <p className="mt-1.5 rounded-lg border border-brand-primary/20 bg-orange-50/80 px-2.5 py-1 text-ui-caption text-slate-700">
                      {t("devCode")}{" "}
                      <span className="font-mono font-bold text-brand-dark">
                        {step.devCode}
                      </span>
                      .
                    </p>
                  )}
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={onResend}
                      disabled={pending}
                      className="text-ui-subhead font-semibold text-brand-primary transition-colors hover:text-brand-dark disabled:opacity-50"
                    >
                      {t("resend")}
                    </button>
                  </div>
                  <SubmitButton pending={pending} label={t("verify")} />
                </form>
              )}

              <div className="mt-5 border-t border-slate-200 pt-4 text-center">
                <p className="text-ui-subhead text-slate-500">
                  {t("needDemo")}{" "}
                  <button
                    type="button"
                    onClick={() => setDemoModalOpen(true)}
                    className="cursor-pointer font-semibold text-brand-primary underline-offset-2 transition-colors hover:text-brand-dark hover:underline"
                  >
                    {t("enterDemo")}
                  </button>
                </p>
              </div>
            </div>

            <div className="mt-3 flex justify-center">
              <p className="inline-flex items-center rounded-full border border-white/60 bg-white/60 px-4 py-1.5 text-center text-ui-body-lg font-medium text-slate-700 shadow-sm backdrop-blur-md">
                <LockIcon className="mr-1.5 size-3.5 text-slate-500" />
                Protected workspace · access is granted by IMGC
              </p>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={demoModalOpen} onOpenChange={setDemoModalOpen}>
        <DialogContent className="sm:max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-slate-900">
              Select Demo Mode
            </DialogTitle>
            <DialogDescription className="text-ui-subhead text-slate-500">
              Choose a role below to explore the portal in demo mode.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => onDemo("IMGC")}
              className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white px-4 py-3 text-center text-ui-subhead font-semibold text-slate-700 shadow-sm transition hover:border-brand-primary/40 hover:bg-brand-primary/5 hover:text-brand-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Demo as IMGC
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onDemo("LENDER")}
              className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white px-4 py-3 text-center text-ui-subhead font-semibold text-slate-700 shadow-sm transition hover:border-brand-primary/40 hover:bg-brand-primary/5 hover:text-brand-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Demo as Lender
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmitButton({
  pending,
  label,
}: Readonly<{ pending: boolean; label: string }>) {
  const t = useTranslations("login");
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary text-ui-lead font-semibold text-white shadow-md shadow-brand-primary/20 transition hover:bg-brand-dark hover:shadow-lg hover:shadow-brand-primary/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("pleaseWait") : label}
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
    <div className="mb-3.5 flex items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white/60 px-3.5 py-2 shadow-sm backdrop-blur-sm">
      <span className="flex min-w-0 items-center gap-2.5 text-ui-subhead font-medium text-slate-800">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white text-slate-500 shadow-sm">
          {icon}
        </span>
        <span className="truncate">{text}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-ui-body-lg font-semibold text-brand-primary hover:text-brand-dark transition-colors"
      >
        Change
      </button>
    </div>
  );
}
