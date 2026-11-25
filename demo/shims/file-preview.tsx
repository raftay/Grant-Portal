import { useEffect, useState } from "react";
import { cn } from "cn";
import { PaperLoader } from "@/components/paper-loader";
import { fileUrl } from "./open-file";

export function FilePreview({ fileId, title, className }: { fileId: string; title: string; className: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let current = true;
    void fileUrl(fileId, "view").then((opened) => current && setUrl(opened));
    return () => {
      current = false;
    };
  }, [fileId]);
  if (!url) {
    return (
      <div className={cn("grid w-full place-items-center rounded-lg border bg-muted", className)}>
        <PaperLoader label="Opening the file" />
      </div>
    );
  }
  return <iframe src={url} title={title} className={cn("w-full rounded-lg border bg-muted", className)} />;
}
