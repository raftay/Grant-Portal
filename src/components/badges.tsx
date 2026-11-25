import type { ReactNode } from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

const tones = {
  mint: "bg-mint text-primary",
  warn: "bg-warn text-warn-foreground",
  danger: "bg-danger text-danger-foreground",
  ai: "bg-ai text-ai-foreground",
  plain: "bg-muted text-muted-foreground",
} as const;

export type Tone = keyof typeof tones;

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <Badge className={cn("rounded-[6px] px-2 py-1 text-xs font-medium whitespace-normal", tones[tone], className)}>{children}</Badge>;
}

export const AiBadge = ({ children = "AI suggested" }: { children?: ReactNode }) => <ToneBadge tone="ai">{children}</ToneBadge>;
