"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, errorMessage, session } from "@/lib/api";
import type { User } from "@/types";

type AuthFormProps = {
  mode: "login" | "register";
};

type AuthResponse = { token: string; user: User };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      ...(isRegister ? { name: form.get("name") } : {}),
      email: form.get("email"),
      password: form.get("password"),
    };

    try {
      const response = await apiRequest<AuthResponse>(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      session.set(response.token);
      router.push("/dashboard");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="auth-glow relative hidden min-h-screen overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="inline-flex items-center gap-3 font-semibold">
          <span className="grid size-10 place-items-center rounded-xl bg-[#d8ff5f] font-bold text-[#14231d]">H</span>
          Hermes Platform
        </Link>
        <div className="relative z-10 max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d8ff5f]">Local control plane</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.03] tracking-[-0.05em]">
            One profile today. One isolated agent tomorrow.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-[#c4d0ca]">
            Start with identity and purpose. Container deployment will connect to the same profile later.
          </p>
        </div>
        <p className="relative z-10 text-sm text-[#9fb0a7]">Secure local MVP · DigitalOcean-ready model</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-12 inline-flex items-center gap-3 font-semibold lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-[#14231d] text-sm font-bold text-[#d8ff5f]">H</span>
            Hermes Platform
          </Link>

          <p className="text-sm font-semibold uppercase tracking-[0.17em] text-[#69820f]">
            {isRegister ? "Create account" : "Welcome back"}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">
            {isRegister ? "Build your agent workspace." : "Log in to your workspace."}
          </h2>
          <p className="mt-3 text-[#677970]">
            {isRegister ? "Your first Hermes agent is only a minute away." : "Continue managing your Hermes profiles."}
          </p>

          {error && (
            <div role="alert" className="alert alert-error mt-7 rounded-2xl text-sm">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {isRegister && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Full name</span>
                <input name="name" className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white" placeholder="Andy Choo" required minLength={2} />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Email address</span>
              <input name="email" type="email" className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white" placeholder="you@example.com" autoComplete="email" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Password</span>
              <input name="password" type="password" className="input h-12 w-full rounded-xl border-[#ccd5ce] bg-white" placeholder="At least 8 characters" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 8 : 1} />
            </label>
            <button type="submit" className="btn h-12 w-full rounded-xl border-0 bg-[#14231d] text-white shadow-none hover:bg-[#254237]" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              {isRegister ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#687970]">
            {isRegister ? "Already have an account?" : "New to Hermes Platform?"}{" "}
            <Link href={isRegister ? "/login" : "/register"} className="font-semibold text-[#14231d] underline decoration-[#b2cc4e] decoration-2 underline-offset-4">
              {isRegister ? "Log in" : "Create an account"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
