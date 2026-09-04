"use client";

import Image from "next/image";
import { useCallback, useState, useTransition } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
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
  "Document Checklist",
  "PAS Accounting Sync",
  "Full Audit Trail",
  "Lender / IMGC Buckets",
  "Reinstatement Workflow",
];

const VALUE_ROWS = [
  {
    title: "Lenders upload once",
    body: "A checklist per account, with save, submit and a full version history.",
  },
  {
    title: "IMGC reviews in place",
    body: "Accept, reject with a reason, or pull the account into the IMGC bucket.",
  },
  {
    title: "Nothing is lost",
    body: "Every upload, remark and PAS write lands on the account's audit trail.",
  },
];

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-white/90">
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-white/15 bg-white/8 pl-10 pr-10 text-[14px] text-white placeholder:text-white/55 outline-none transition focus:border-[#f37819] focus:bg-white/12 focus:ring-2 focus:ring-[#f37819]/30";

export function LoginClient({ returnTo }: Readonly<{ returnTo?: string }>) {
  const [step, setStep] = useState<Step>({ kind: "IDENTIFY" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    /* `isolate` is load-bearing: the backdrop layers below sit at negative
       z-index, and without a stacking context here they paint *behind* this
       element's own opaque background — the video and the colour fields were
       rendering, invisibly, under a flat navy rectangle. */
    <div className="relative isolate min-h-dvh w-full overflow-hidden bg-[#1a120c] text-white subpixel-antialiased">
      {/* ── Backdrop ────────────────────────────────────────────────────
          A looping video rather than a still: the page is the product's
          front door and motion is the cheapest way to make it feel alive.
          Muted + playsInline so it autoplays everywhere, aria-hidden and
          pointer-events-none so it is scenery and nothing else. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        /* The clip averages ~25/255 brightness, so straight out of the file it
           reads as a flat black rectangle. Lifting it here is what makes the
           motion visible at all; the wash below then takes it back down to a
           level white text sits on comfortably. */
        className="pointer-events-none absolute inset-0 -z-20 size-full object-cover [filter:brightness(1.4)_contrast(1.05)_saturate(0.55)_sepia(0.25)]"
      >
        <source src="/assets/videos/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Darkening wash — enough to keep white text legible over a moving
          picture, light enough that the motion still reads. Heavier on the
          left, where the headline sits. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(20,12,8,0.94)_0%,rgba(28,17,10,0.78)_45%,rgba(20,12,8,0.85)_100%)]"
      />

      {/* Two slow-drifting colour fields. Transform/opacity only. */}
      <div
        aria-hidden
        className="imgc-drift pointer-events-none absolute -left-40 top-1/4 -z-10 h-[560px] w-[560px] rounded-full bg-[#f37819]/30 blur-[150px]"
      />
      <div
        aria-hidden
        className="imgc-drift-slow pointer-events-none absolute -right-32 -top-28 -z-10 h-[520px] w-[520px] rounded-full bg-[#d98b2b]/26 blur-[150px]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-6 py-6 lg:px-10">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="imgc-rise flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Image
                src="/assets/icons/imgc-mark.svg"
                alt=""
                width={26}
                height={26}
                aria-hidden
              />
            </span>
            <span className="leading-tight">
              <span className="block font-outfit text-[17px] font-bold tracking-tight">
                IMGC Lender Portal
              </span>
              <span className="block text-[12px] text-white/75">
                Initial Claims Platform
              </span>
            </span>
          </div>
          <span className="flex flex-col items-end leading-none">
            <span className="font-outfit text-[20px] font-semibold tracking-tight text-white">
              IMGC
              <span className="ml-1 align-super text-[10px] font-medium text-[#ffb27a]">
                ®
              </span>
            </span>
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-white/50">
              Defining Tomorrow
            </span>
          </span>
        </header>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col gap-10 py-10 lg:flex-row lg:items-center lg:gap-16 lg:py-6">
          {/* Left: the proposition */}
          <section className="imgc-rise min-w-0 flex-1">
            {/* text-white on the element itself: globals.css pins a colour on
                h1..h6 in @layer base, which beats a colour inherited from the
                panel around it. */}
            <h1 className="font-outfit max-w-[620px] text-[34px] font-bold leading-[1.12] tracking-tight text-white sm:text-[44px]">
              One claims workspace{" "}
              <span className="text-[#ffb27a]">for every lender.</span>
            </h1>
            <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-white/85">
              Collect once, review everywhere — documents, PAS values and a
              complete audit trail on a single account.
            </p>

            <ul className="mt-7 flex max-w-[620px] flex-wrap gap-2">
              {FEATURE_PILLS.map((pill) => (
                <li
                  key={pill}
                  className="flex items-center gap-1.5 rounded-full border border-white/12 bg-[#2f1f16] px-3 py-1.5 text-[12px] font-medium text-white/90"
                >
                  <CheckCircle2Icon className="size-3.5 shrink-0 text-[#ffb27a]" />
                  {pill}
                </li>
              ))}
            </ul>

            <dl className="mt-9 max-w-[560px] space-y-5 border-l border-white/12 pl-5">
              {VALUE_ROWS.map((row) => (
                <div key={row.title}>
                  <dt className="text-[14px] font-semibold text-white">
                    {row.title}
                  </dt>
                  <dd className="mt-0.5 text-[13px] leading-relaxed text-white/75">
                    {row.body}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Right: sign-in card */}
          <section className="imgc-rise w-full shrink-0 lg:w-[420px]">
            <div className="rounded-2xl border border-white/12 bg-[#241812] p-7 shadow-2xl shadow-black/50">
              <h2 className="font-outfit text-center text-[24px] font-bold tracking-tight text-white">
                Welcome Back
              </h2>
              <p className="mt-1 mb-6 text-center text-[13px] text-white/80">
                Sign in to your IMGC Lender Portal account
              </p>

              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-[#ff5f57]/40 bg-[#ff5f57]/10 px-3 py-2 text-[12.5px] text-[#ffb4b0]"
                >
                  {error}
                </p>
              )}
              {!error && notice && (
                <p className="mb-4 rounded-lg border border-[#ffb27a]/30 bg-[#ffb27a]/10 px-3 py-2 text-[12.5px] text-[#9df0de]">
                  {notice}
                </p>
              )}

              {step.kind === "IDENTIFY" && (
                <form onSubmit={onIdentify} noValidate>
                  <FieldLabel>Employee ID or Email</FieldLabel>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
                    <input
                      name="identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="EMP-0001  or  you@lender.com"
                      autoComplete="username"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/70">
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
                    <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
                    <input
                      // This field exists only because the user just pressed Continue, so
                      // focusing it continues the action they started rather than seizing
                      // focus on page load.
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/65 hover:text-white/75"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/85">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="size-4 accent-[#f37819]"
                      />
                      Remember me
                    </label>
                    <span className="text-[13px] font-medium text-white/70">
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
                    // Revealed by the user's own Continue press; entering the code is the
                    // only thing left to do.
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    autoComplete="one-time-code"
                    className="h-12 w-full rounded-lg border border-white/15 bg-white/8 text-center font-mono text-[22px] tracking-[0.5em] text-white placeholder:text-white/45 outline-none transition focus:border-[#f37819] focus:bg-white/12 focus:ring-2 focus:ring-[#f37819]/30"
                  />
                  {step.devCode && (
                    <p className="mt-2 rounded-md border border-white/12 bg-white/5 px-2.5 py-1.5 text-[11.5px] text-white/80">
                      Development only — no mail is sent. Your code is{" "}
                      <span className="font-mono font-bold text-[#ffb27a]">
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
                      className="text-[12.5px] font-medium text-[#ffb27a] hover:text-white disabled:opacity-50"
                    >
                      Send a new code
                    </button>
                  </div>
                  <SubmitButton pending={pending} label="Verify & Sign In" />
                </form>
              )}

              <div className="mt-5 border-t border-white/10 pt-4 text-center">
                <p className="text-[12.5px] text-white/75">
                  Need demo access?{" "}
                  <span className="font-semibold text-white">
                    Enter Demo Mode
                  </span>
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDemo("IMGC")}
                    className="rounded-lg border border-white/15 bg-white/6 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:border-white/30 hover:bg-white/12 disabled:opacity-50"
                  >
                    Demo as IMGC
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDemo("LENDER")}
                    className="rounded-lg border border-white/15 bg-white/6 px-3 py-2 text-[12.5px] font-semibold text-white transition hover:border-white/30 hover:bg-white/12 disabled:opacity-50"
                  >
                    Demo as Lender
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[12px] text-white/60">
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
      className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f37819] text-[14px] font-semibold text-white transition hover:bg-[#d2670f] disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-white/85">
        <span className="text-white/65">{icon}</span>
        <span className="truncate">{text}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-[12px] font-medium text-[#ffb27a] hover:text-white"
      >
        Change
      </button>
    </div>
  );
}
