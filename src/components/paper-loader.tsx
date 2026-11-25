import type { CSSProperties } from "react";
import { cn } from "cn";

const sizes = { xs: 0.2, sm: 0.4, md: 0.7, lg: 1 } as const;

type Props = { label: string; size?: keyof typeof sizes; progress?: number; showLabel?: boolean; className?: string };

const sheetStyle = (index: number, rise: number) =>
  ({ "--rise": `${-index * rise}px`, "--from": `${index % 2 ? -95 : 95}px` }) as CSSProperties;

export function PaperLoader({ label, size = "md", progress, showLabel = size === "md" || size === "lg", className }: Props) {
  const determinate = progress !== undefined;
  const sheets = determinate ? 8 : 5;
  const landed = determinate ? Math.round(Math.min(1, Math.max(0, progress)) * sheets) : 0;
  const percent = determinate ? Math.round(progress * 100) : undefined;
  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      role={determinate ? "progressbar" : "status"}
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={percent}
    >
      <div className={cn("paper-loader", determinate && "paper-progress")} style={{ "--size": sizes[size] } as CSSProperties} aria-hidden="true">
        <div className="paper-scene">
          <div className="paper-shadow" />
          <div className="paper-stack">
            {Array.from({ length: sheets }, (_, index) => (
              <div key={index} className="paper-sheet" style={sheetStyle(index, determinate ? 5 : 7)} data-landed={determinate ? index < landed : undefined} />
            ))}
            <div className="paper-seal" data-landed={determinate ? landed === sheets : undefined}>
              $
            </div>
          </div>
        </div>
      </div>
      {showLabel && (
        <p className="text-[13px] font-medium text-muted-foreground" aria-hidden="true">
          {label}
          {percent !== undefined && <span className="ml-1.5 tabular-nums text-primary">{percent}%</span>}
        </p>
      )}
    </div>
  );
}
