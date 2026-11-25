"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type DragEvent } from "react";
import { cn } from "cn";
import { addContract, addDocument, finishUpload, replaceFile, startUpload, suggestDates, type DateSuggestions, type Suggestion } from "@/app/actions/files";
import { AiBadge } from "@/components/badges";
import { ActionForm } from "@/components/forms/action-form";
import { CheckField, SelectField, TextField, type Choice } from "@/components/forms/fields";
import { PaperLoader } from "@/components/paper-loader";
import { Notice, SensitiveNotice } from "@/components/panels";
import { formatBytes } from "@/lib/format";
import { fileTypeLabels } from "@/lib/labels";
import { fileTypes, type FileType } from "@/lib/validation/files";

const readable = ["application/pdf", "image/png", "image/jpeg"];
const accept = Object.keys(fileTypes).join(",");

function send(url: string, headers: Record<string, string>, file: File, onProgress: (share: number) => void): Promise<void> {
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

async function uploadFile(file: File, onProgress: (share: number) => void): Promise<string> {
  const started = await startUpload({ name: file.name, mimeType: file.type as FileType, sizeBytes: file.size });
  if (!started.ok) throw new Error(started.message);
  await send(started.value.url, started.value.headers, file, onProgress);
  const finished = await finishUpload(started.value.fileId);
  if (!finished.ok) throw new Error(finished.message);
  return started.value.fileId;
}

type Progress = { name: string; share: number };

function useUploader() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const run = async (file: File, then: (fileId: string) => Promise<void>) => {
    setError("");
    setProgress({ name: file.name, share: 0 });
    try {
      await then(await uploadFile(file, (share) => setProgress({ name: file.name, share })));
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setProgress(null);
    }
  };
  return { progress, error, run };
}

const UploadError = ({ message }: { message: string }) =>
  message ? <p role="alert" className="rounded-lg bg-danger px-3.5 py-2.5 text-danger-foreground">{message}</p> : null;

const UploadProgress = ({ progress }: { progress: Progress }) => (
  <div className="rounded-lg border border-dashed bg-muted py-3">
    <PaperLoader size="md" progress={progress.share} label={progress.share < 1 ? `Uploading ${progress.name}` : "Checking the file"} />
  </div>
);

function FilePicker({ label, onPick, current }: { label: string; onPick: (file: File) => void; current?: File }) {
  const id = useId();
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onPick(file);
  };
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn("rounded-lg border border-dashed border-[#b7c9c4] bg-muted p-5", over && "bg-mint")}
    >
      <p className="text-[15px] font-semibold break-words">{current ? current.name : "Drop a file here"}</p>
      <p className="mt-1 mb-3 text-muted-foreground">
        {current ? `${fileTypeLabels[current.type]} · ${formatBytes(current.size)} · Ready` : "PDF, image, Excel or Word, up to 15 MB"}
      </p>
      <label htmlFor={id} className="inline-flex h-10 cursor-pointer items-center rounded-[7px] border bg-card px-3.5 font-semibold focus-within:ring-2 focus-within:ring-ring hover:bg-accent">
        {current ? "Choose another file" : label}
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPick(file);
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

const Evidence = ({ suggestion }: { suggestion: Suggestion | null }) =>
  suggestion?.evidence ? (
    <p className="-mt-2 text-xs text-ai-foreground">
      “{suggestion.evidence}”{suggestion.page ? ` · page ${suggestion.page}` : ""}
    </p>
  ) : null;

export function NewDocument({ grantId, owners, categories }: { grantId: string; owners: Choice[]; categories: Choice[] }) {
  const router = useRouter();
  const { progress, error, run } = useUploader();
  const [file, setFile] = useState<File>();
  const [fileId, setFileId] = useState("");
  const [reading, setReading] = useState(false);
  const [readingError, setReadingError] = useState("");
  const [dates, setDates] = useState<DateSuggestions>();

  const read = async (id: string) => {
    setReading(true);
    try {
      setDates(await suggestDates(id));
    } catch {
      setReadingError("AI could not read this file. Enter the dates by hand.");
    } finally {
      setReading(false);
    }
  };

  const pick = (chosen: File) =>
    run(chosen, async (id) => {
      setFile(chosen);
      setFileId(id);
      setDates(undefined);
      setReadingError("");
      if (readable.includes(chosen.type)) await read(id);
    });

  const suggested = Boolean(dates?.expiresOn || dates?.reviewOn);
  return (
    <div className="flex flex-col gap-4">
      {progress && !fileId ? <UploadProgress progress={progress} /> : <FilePicker label="Choose file" current={file} onPick={pick} />}
      <UploadError message={error} />
      {reading && (
        <div className="rounded-lg bg-ai py-3">
          <PaperLoader size="md" label="Reading the document" />
        </div>
      )}
      {readingError && <Notice tone="warn" title={readingError} />}
      {dates && !suggested && <Notice tone="ai" title="No dates found">AI read the file and found no expiry or review date. Add them by hand if you need them.</Notice>}
      <ActionForm
        key={dates?.extractionId ?? fileId}
        action={addDocument}
        submitLabel="Confirm & upload"
        pendingLabel="Saving"
        fullWidth
        disabled={!fileId || reading}
        onDone={() => {
          setFile(undefined);
          setFileId("");
          setDates(undefined);
          router.refresh();
        }}
      >
        <input type="hidden" name="grantId" value={grantId} />
        <input type="hidden" name="fileId" value={fileId} />
        <input type="hidden" name="extractionId" value={dates ? dates.extractionId : ""} />
        <TextField name="title" label="Document title" placeholder="Enter a title" defaultValue={file ? file.name.replace(/\.[^.]+$/, "") : ""} required />
        <SelectField name="category" label="Document type" choices={categories} defaultValue="other" />
        <SelectField name="ownerId" label="Owner" choices={owners} placeholder="No owner" defaultValue="" />
        <TextField name="expiresOn" label="Expiration date · Optional" type="date" ai={Boolean(dates?.expiresOn)} defaultValue={dates?.expiresOn ? dates.expiresOn.value : ""} />
        <Evidence suggestion={dates ? dates.expiresOn : null} />
        <TextField name="reviewOn" label="Next review date · Optional" type="date" ai={Boolean(dates?.reviewOn)} defaultValue={dates?.reviewOn ? dates.reviewOn.value : ""} />
        <Evidence suggestion={dates ? dates.reviewOn : null} />
        {suggested && (
          <>
            <Notice tone="ai" title="Review proposed dates">AI dates are suggestions. You can change them or leave dates blank.</Notice>
            <CheckField name="reviewed" label="I reviewed the suggested dates." />
          </>
        )}
        {dates && !suggested && <input type="hidden" name="reviewed" value="on" />}
      </ActionForm>
      <SensitiveNotice />
    </div>
  );
}

export function ReplaceFile({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { progress, error, run } = useUploader();
  const pick = (file: File) =>
    run(file, async (fileId) => {
      const result = await replaceFile(documentId, fileId);
      if (!result.ok) throw new Error(result.message);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      {progress ? <UploadProgress progress={progress} /> : <FilePicker label="Choose the new version" onPick={pick} />}
      <UploadError message={error} />
      <SensitiveNotice />
    </div>
  );
}

export function ContractUpload({ grantId, documentId }: { grantId: string; documentId?: string }) {
  const router = useRouter();
  const { progress, error, run } = useUploader();
  const pick = (file: File) =>
    run(file, async (fileId) => {
      const result = documentId ? await replaceFile(documentId, fileId) : await addContract(grantId, fileId);
      if (!result.ok) throw new Error(result.message);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      {progress ? <UploadProgress progress={progress} /> : <FilePicker label={documentId ? "Upload a new version" : "Choose the contract"} onPick={pick} />}
      <UploadError message={error} />
      <SensitiveNotice />
    </div>
  );
}

export function ReadingForm({ action, grantId }: { action: Parameters<typeof ActionForm>[0]["action"]; grantId: string }) {
  return (
    <ActionForm action={action} submitLabel="Read with AI" pendingLabel="Reading the contract">
      <input type="hidden" name="grantId" value={grantId} />
      <p className="text-muted-foreground">
        AI proposes award details and deadlines. <AiBadge>Nothing is saved until you confirm</AiBadge>
      </p>
    </ActionForm>
  );
}

