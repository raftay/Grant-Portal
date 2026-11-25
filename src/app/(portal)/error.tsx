"use client";

import { Button } from "@/components/ui/button";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="content" className="grid min-h-[70dvh] place-items-center px-6">
      <div role="alert" className="max-w-md text-center">
        <h1 className="text-[22px] font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Nothing was saved by this step.{error.digest && ` Reference ${error.digest}.`}</p>
        <Button className="mt-5" onClick={reset}>Reload this page</Button>
      </div>
    </main>
  );
}
