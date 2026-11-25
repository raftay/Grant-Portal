import { cn } from "cn";

export function FilePreview({ fileId, title, className }: { fileId: string; title: string; className: string }) {
  return <iframe src={`/api/files/${fileId}?mode=view`} title={title} className={cn("w-full rounded-lg border bg-muted", className)} />;
}
