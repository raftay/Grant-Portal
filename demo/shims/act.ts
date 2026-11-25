import type { FormState } from "@/server/action";
import { navigate, Redirect, refresh } from "./navigation";

export function act<Input extends unknown[]>(action: (...input: Input) => Promise<FormState>): (...input: Input) => Promise<FormState> {
  return async (...input) => {
    try {
      return await action(...input);
    } catch (error) {
      if (!(error instanceof Redirect)) throw error;
      navigate(error.to);
      refresh();
      return { status: "done", message: "" };
    }
  };
}
