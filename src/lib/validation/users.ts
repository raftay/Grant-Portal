import { z } from "zod";
import { email, password, text } from "./common";

export const role = z.enum(["admin", "staff", "viewer"]);
export const inviteInput = z.object({ name: text(100), email, role });
export const acceptInviteInput = z.object({ token: z.string().min(20).max(200), name: text(100), password });
export const resetPasswordInput = z.object({ token: z.string().min(20).max(200), password });
