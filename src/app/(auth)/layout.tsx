import type { ReactNode } from "react";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-card lg:grid lg:grid-cols-[minmax(360px,620px)_1fr]">
      <aside className="flex flex-col bg-deep px-6 py-8 text-white lg:p-16">
        <p className="font-semibold tracking-wide text-[#cfe5dc] uppercase">Grant Portal</p>
        <div className="my-auto hidden max-w-[490px] pt-10 lg:block">
          <p className="text-[46px] leading-[1.45] font-semibold">
            More focus on<br />your mission.<br />Less on admin.
          </p>
          <p className="mt-4 max-w-[340px] text-[17px] text-[#b5d2c7]">One secure workspace for your grants, documents, deadlines and spending.</p>
          <hr className="my-6 border-[#b5d2c7]" />
          <ul className="flex flex-col gap-5 text-[15px]">
            <li>Six grants. One clear picture.</li>
            <li>Every dollar traceable.</li>
            <li>AI assists. Your team decides.</li>
          </ul>
        </div>
        <p className="hidden text-xs text-[#b5d2c7] lg:block">Private workspace · Invitation-only access</p>
      </aside>
      <main id="content" className="flex items-center px-6 py-10 lg:px-[90px]">
        <div className="flex w-full max-w-[640px] flex-col gap-5">
          {children}
          {env().SAMPLE_DATA === "true" && <p className="text-xs text-muted-foreground">Grant Portal · Sample workspace</p>}
        </div>
      </main>
    </div>
  );
}
