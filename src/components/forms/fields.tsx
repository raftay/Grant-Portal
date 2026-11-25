"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AiBadge } from "@/components/badges";
import { useFieldError } from "./action-form";

type Shared = { name: string; label: string; hint?: string; ai?: boolean };

function Wrap({ id, label, hint, ai, error, children }: Omit<Shared, "name"> & { id: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </Label>
        {ai && <AiBadge />}
      </div>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs font-medium text-danger-foreground">{error}</p>}
    </div>
  );
}

const aiStyle = "border-ai-border bg-ai/40";

function useField(name: string, hint?: string) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return { id, error, aria: { "aria-invalid": error ? true : undefined, "aria-describedby": describedBy } };
}

export function TextField({ name, label, hint, ai, className, ...props }: Shared & ComponentProps<typeof Input>) {
  const { id, error, aria } = useField(name, hint);
  return (
    <Wrap {...{ id, label, hint, ai, error }}>
      <Input id={id} name={name} className={cn(ai && aiStyle, className)} {...aria} {...props} />
    </Wrap>
  );
}

export function TextAreaField({ name, label, hint, ai, className, ...props }: Shared & ComponentProps<typeof Textarea>) {
  const { id, error, aria } = useField(name, hint);
  return (
    <Wrap {...{ id, label, hint, ai, error }}>
      <Textarea id={id} name={name} className={cn(ai && aiStyle, className)} {...aria} {...props} />
    </Wrap>
  );
}

export type Choice = { value: string; label: string };

export function SelectField({
  name,
  label,
  hint,
  ai,
  choices,
  placeholder,
  className,
  ...props
}: Shared & { choices: Choice[]; placeholder?: string } & Omit<ComponentProps<typeof NativeSelect>, "size">) {
  const { id, error, aria } = useField(name, hint);
  return (
    <Wrap {...{ id, label, hint, ai, error }}>
      <NativeSelect id={id} name={name} className={cn(ai && aiStyle, className)} {...aria} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </NativeSelect>
    </Wrap>
  );
}

export function CheckField({ name, label, ...props }: { name: string; label: ReactNode } & ComponentProps<"input">) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2.5">
        <input id={id} name={name} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" {...props} />
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
      </div>
      {error && <p className="text-xs font-medium text-danger-foreground">{error}</p>}
    </div>
  );
}
