"use client";

import { createContext, startTransition, use, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { cn } from "cn";
import { PaperLoader } from "@/components/paper-loader";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/server/action";

export type FormAction = (state: FormState, form: FormData) => Promise<FormState>;

const FieldErrors = createContext<Record<string, string>>({});
export const useFieldError = (name: string) => use(FieldErrors)[name];

type Props = {
  action: FormAction;
  submitLabel: string;
  pendingLabel: string;
  children: ReactNode;
  className?: string;
  secondary?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  onDone?: () => void;
  resetOnDone?: boolean;
};

export function ActionForm({ action, submitLabel, pendingLabel, children, className, secondary, fullWidth, disabled, onDone, resetOnDone }: Props) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (state.status !== "done") return;
    if (resetOnDone) form.current?.reset();
    done.current?.();
  }, [state, resetOnDone]);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return (
    <FieldErrors value={state.status === "error" ? state.fields : {}}>
      <form ref={form} method="post" onSubmit={onSubmit} className={cn("flex flex-col gap-4", className)} noValidate aria-busy={pending}>
        {children}
        {state.status === "error" && (
          <p role="alert" className="rounded-lg bg-danger px-3.5 py-2.5 text-danger-foreground">
            {state.message}
          </p>
        )}
        {state.status === "done" && state.message !== "" && (
          <p role="status" className="rounded-lg bg-mint px-3.5 py-2.5 font-medium text-primary">
            {state.message}
          </p>
        )}
        <div className={cn("flex flex-wrap gap-3", fullWidth && "flex-col")}>
          {!fullWidth && secondary}
          <Button type="submit" disabled={pending || disabled} className={cn(fullWidth && "w-full")}>
            {pending && <PaperLoader label={pendingLabel} size="xs" showLabel={false} />}
            {pending ? pendingLabel : submitLabel}
          </Button>
          {fullWidth && secondary}
        </div>
      </form>
    </FieldErrors>
  );
}
