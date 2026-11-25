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

export function FileLinks({ fileId, name }: { fileId: string; name: string }) {
  return (
    <span className="inline-flex gap-3 whitespace-nowrap">
      <a href={`/api/files/${fileId}?mode=view`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline" aria-label={`View ${name}`}>View ↗</a>
      <a href={`/api/files/${fileId}?mode=download`} className="font-medium text-primary hover:underline" aria-label={`Download ${name}`}>Download</a>
    </span>
  );
}
