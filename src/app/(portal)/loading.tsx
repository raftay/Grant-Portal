import { PaperLoader } from "@/components/paper-loader";

export default function Loading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center">
      <PaperLoader size="lg" label="Getting your papers in order" />
    </div>
  );
}
