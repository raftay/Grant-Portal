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
