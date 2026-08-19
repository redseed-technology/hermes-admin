import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in · Hermes Platform" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
