import { AuthExperience } from "@/app/components/auth-experience";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Mono",
};

export default function AuthPage() {
  return <AuthExperience />;
}
