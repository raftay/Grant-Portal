import { fileUrl } from "./open-file";

async function view(fileId: string): Promise<void> {
  window.open(await fileUrl(fileId, "view"), "_blank");
}

async function download(fileId: string, name: string): Promise<void> {
  const anchor = document.createElement("a");
  anchor.href = await fileUrl(fileId, "download");
  anchor.download = name;
  anchor.click();
}

const style = "font-medium text-primary hover:underline";

export function FileLinks({ fileId, name }: { fileId: string; name: string }) {
  return (
    <span className="inline-flex gap-3 whitespace-nowrap">
      <button type="button" className={style} onClick={() => view(fileId)} aria-label={`View ${name}`}>View ↗</button>
      <button type="button" className={style} onClick={() => download(fileId, name)} aria-label={`Download ${name}`}>Download</button>
    </span>
  );
}
