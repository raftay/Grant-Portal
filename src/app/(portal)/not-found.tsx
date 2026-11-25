import Link from "next/link";

export default function PortalNotFound() {
  return (
    <main id="content" className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <h1 className="text-[22px] font-semibold">Not found</h1>
        <p className="mt-2 text-muted-foreground">This page does not exist, or you do not have access to it.</p>
        <Link href="/" className="mt-5 inline-block font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    </main>
  );
}
