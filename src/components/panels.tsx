import type { ReactNode } from "react";
import { cn } from "cn";

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[10px] border bg-card p-4 sm:p-[22px]", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          {title && <h2 className="text-[18px] leading-7 font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const notices = { mint: ["bg-mint", "text-primary"], ai: ["bg-ai", "text-ai-foreground"], warn: ["bg-warn", "text-warn-foreground"] } as const;

export function Notice({ tone = "mint", title, children, action, className }: { tone?: keyof typeof notices; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg p-4", notices[tone][0], className)}>
      <div className="min-w-0">
        <p className={cn("font-semibold", notices[tone][1])}>{title}</p>
        {children && <div className="mt-1 text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, note, placeholder }: { label: string; value: ReactNode; note: ReactNode; placeholder?: boolean }) {
  return (
    <div className={cn("rounded-[10px] border bg-card p-4 sm:p-[22px]", placeholder && "border-dashed")}>
      <p className="font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[22px] leading-9 font-semibold sm:text-[28px]", placeholder && "text-muted-foreground/70")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export const PhaseTwoStat = ({ label }: { label: string }) => <Stat label={label} value="—" note="Arrives in Phase 2" placeholder />;

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground">{children}</p>;
}

export const SensitiveNotice = () => (
  <p className="text-xs text-muted-foreground">
    Upload only what is needed. Files may contain bank, routing or wire numbers or cheque images. Stored privately.
  </p>
);
