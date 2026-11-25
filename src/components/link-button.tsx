import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function LinkButton({ href, children, variant = "outline" }: { href: string; children: ReactNode; variant?: "default" | "outline" }) {
  return (
    <Button asChild variant={variant}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
