import { Notice } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { credentials, reset } from "./database";

const rows = [
  ["Admin", "alex@example.org", credentials.alex],
  ["Staff", "jamie@example.org", credentials.jamie],
  ["View-only", "taylor@example.org", credentials.taylor],
] as const;

function fill(email: string, password: string): void {
  for (const [name, value] of [["email", email], ["password", password]] as const) {
    const input = document.querySelector<HTMLInputElement>(`form input[name="${name}"]`);
    if (!input) throw new Error("The sign-in form is missing");
    input.value = value;
  }
}

export function DemoAccounts() {
  return (
    <Notice title="Demo accounts">
      <p>Everything here is fictional and stays in this browser. Nothing is sent anywhere, and AI reading is simulated.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map(([role, email, password]) => (
          <li key={email} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-foreground">{role}</strong> · {email} · <code className="rounded bg-card px-1.5 py-0.5">{password}</code>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => fill(email, password)}>Use {role}</Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="link" className="mt-3 h-auto p-0" onClick={reset}>Reset the demo data</Button>
    </Notice>
  );
}
