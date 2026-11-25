"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { field, submit, type FormState } from "@/server/action";
import { acceptInvite, requestPasswordReset, resetPassword } from "@/server/auth/accounts";
import { signIn, signOut } from "@/server/auth/config";

const messages: Record<string, string> = {
  throttled: "Too many attempts. Try again in 15 minutes.",
  credentials: "That email and password do not match an active account.",
};

export async function passwordSignIn(_state: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", { email: field(form, "email"), password: field(form, "password"), redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError && "code" in error) {
      const message = messages[String(error.code)];
      if (message) return { status: "error", message, fields: {} };
    }
    throw error;
  }
  return { status: "done", message: "" };
}

export async function linkSignIn(_state: FormState, form: FormData): Promise<FormState> {
  await signIn("email", { email: field(form, "email"), redirectTo: "/" });
  return { status: "done", message: "" };
}

export async function leave(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function askForReset(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await requestPasswordReset(field(form, "email"));
    return "If that address has an account, a reset link is on its way.";
  });
}

export async function chooseNewPassword(_state: FormState, form: FormData): Promise<FormState> {
  const result = await submit(async () => {
    await resetPassword({ token: field(form, "token"), password: field(form, "password") });
    return "";
  });
  if (result.status === "done") redirect("/login?reset=1");
  return result;
}

export async function joinWorkspace(_state: FormState, form: FormData): Promise<FormState> {
  const result = await submit(async () => {
    await acceptInvite({ token: field(form, "token"), name: field(form, "name"), password: field(form, "password") });
    return "";
  });
  if (result.status === "done") redirect("/login?joined=1");
  return result;
}
