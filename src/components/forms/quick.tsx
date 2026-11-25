"use client";

import { startTransition, useActionState, useState, type ReactNode } from "react";
import { PaperLoader } from "@/components/paper-loader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import type { FormState } from "@/server/action";
import type { FormAction } from "./action-form";
import type { Choice } from "./fields";

function toForm(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

const Feedback = ({ state }: { state: FormState }) =>
  state.status === "error" ? (
    <p role="alert" className="mt-1 text-xs font-medium text-danger-foreground">{state.message}</p>
  ) : state.status === "done" && state.message ? (
    <p role="status" className="mt-1 text-xs font-medium text-primary">{state.message}</p>
  ) : null;

type ActionButtonProps = {
  action: FormAction;
  values: Record<string, string>;
  label: string;
  pendingLabel: string;
  confirm?: { title: string; body: ReactNode };
  variant?: "default" | "outline" | "link" | "destructive";
};

export function ActionButton({ action, values, label, pendingLabel, confirm, variant = "outline" }: ActionButtonProps) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, { status: "idle" });
  const [asking, setAsking] = useState(false);
  const run = () => {
    setAsking(false);
    startTransition(() => dispatch(toForm(values)));
  };
  return (
    <span className="inline-flex flex-col items-start">
      <Button type="button" variant={variant} className={variant === "link" ? "h-auto p-0" : undefined} disabled={pending} onClick={() => (confirm ? setAsking(true) : run())}>
        {pending && <PaperLoader label={pendingLabel} size="xs" showLabel={false} />}
        {pending ? pendingLabel : label}
      </Button>
      <Feedback state={state} />
      {confirm && (
        <Dialog open={asking} onOpenChange={setAsking}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.body}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAsking(false)}>Cancel</Button>
              <Button type="button" onClick={run}>{label}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </span>
  );
}

export function QuickSelect({ action, values, current, choices, label }: { action: FormAction; values: Record<string, string>; current: string; choices: Choice[]; label: string }) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, { status: "idle" });
  return (
    <div className="inline-block min-w-32 text-left">
      <div className="flex items-center gap-2">
        <NativeSelect
          key={current}
          size="sm"
          aria-label={label}
          defaultValue={current}
          disabled={pending}
          onChange={(event) => {
            const form = toForm({ ...values, value: event.target.value });
            startTransition(() => dispatch(form));
          }}
        >
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>{choice.label}</option>
          ))}
        </NativeSelect>
        {pending && <PaperLoader label="Saving" size="xs" showLabel={false} />}
      </div>
      <Feedback state={state} />
    </div>
  );
}

export function FilterSelect({ name, label, current, choices }: { name: string; label: string; current: string; choices: Choice[] }) {
  return (
    <div className="w-full sm:w-44">
      <NativeSelect name={name} aria-label={label} defaultValue={current} className="h-10 font-semibold" onChange={(event) => event.target.form!.requestSubmit()}>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>{choice.label}</option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<"idle" | "copied">("idle");
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setState("copied");
    setTimeout(() => setState("idle"), 1800);
  };
  return (
    <div className="flex items-end justify-between gap-3 border-b py-3 first:pt-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-medium break-words">{value}</p>
      </div>
      <button type="button" onClick={copy} className="min-h-9 shrink-0 rounded-md border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Copy ${label}`}>
        {state === "copied" ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
