export function AuthHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-primary uppercase">{eyebrow}</p>
      <h1 className="mt-4 text-[26px] font-semibold sm:text-[30px]">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
