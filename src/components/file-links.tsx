export function FileLinks({ fileId, name }: { fileId: string; name: string }) {
  return (
    <span className="inline-flex gap-3 whitespace-nowrap">
      <a href={`/api/files/${fileId}?mode=view`} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline" aria-label={`View ${name}`}>View ↗</a>
      <a href={`/api/files/${fileId}?mode=download`} className="font-medium text-primary hover:underline" aria-label={`Download ${name}`}>Download</a>
    </span>
  );
}
