export function sendFile(url: string, headers: Record<string, string>, file: File, onProgress: (share: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    request.onload = () => (request.status === 200 ? resolve() : reject(new Error(`Storage refused the upload (${request.status}).`)));
    request.onerror = () => reject(new Error("The upload did not reach storage."));
    request.send(file);
  });
}
