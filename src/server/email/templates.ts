const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => entities[character]!);

function layout(heading: string, body: string, link: string, label: string): string {
  return [
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#123e36">',
    `<h1 style="font-size:20px">${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(body)}</p>`,
    `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#05624f;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`,
    "</div>",
  ].join("");
}

export type EmailContent = { subject: string; html: string };

export const inviteEmail = (name: string, link: string): EmailContent => ({
  subject: "You have been invited to Grant Portal",
  html: layout(`Welcome, ${name}`, "Set a password to start using Grant Portal. This link works once and lasts 72 hours.", link, "Accept invitation"),
});

export const passwordResetEmail = (name: string, link: string): EmailContent => ({
  subject: "Reset your Grant Portal password",
  html: layout(`Hello, ${name}`, "Use this link to choose a new password. It works once and lasts one hour. If you did not ask for it, ignore this email.", link, "Choose a new password"),
});

export const signInEmail = (link: string): EmailContent => ({
  subject: "Your Grant Portal sign-in link",
  html: layout("Sign in to Grant Portal", "This link works once and lasts 15 minutes. If you did not ask for it, ignore this email.", link, "Sign in"),
});

const wording = {
  doc_expiry: { "30d": "expires on", overdue: "expired on" },
  doc_review: { "30d": "is due for review on", overdue: "was due for review on" },
  deadline: { reminder: "is due on", overdue: "was due on" },
} as const;

type AlertDetails = {
  kind: keyof typeof wording;
  milestone: "30d" | "reminder" | "overdue";
  title: string;
  grantName: string | null;
  dueOn: string;
  recipientName: string;
  link: string;
};

export function alertEmail(alert: AlertDetails): EmailContent {
  const phrase = (wording[alert.kind] as Partial<Record<AlertDetails["milestone"], string>>)[alert.milestone];
  if (!phrase) throw new Error(`No wording for ${alert.kind} at ${alert.milestone}`);
  const day = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${alert.dueOn}T00:00:00Z`));
  const subject = alert.grantName ? `${alert.title} (${alert.grantName})` : alert.title;
  return {
    subject: `${alert.milestone === "overdue" ? "Overdue" : "Reminder"}: ${subject.replace(/[\r\n]+/g, " ")}`,
    html: layout(`Hello, ${alert.recipientName}`, `${subject} ${phrase} ${day}.`, alert.link, "Open Grant Portal"),
  };
}
