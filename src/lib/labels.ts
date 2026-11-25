import type { DeadlineState, DocumentState } from "./dates";

export const roleLabels = { admin: "Admin", staff: "Staff", viewer: "View-only" } as const;
export const userStatusLabels = { active: "Active", invited: "Invited", deactivated: "Deactivated" } as const;
export const grantStatusLabels = { draft: "Draft", active: "Active", closed: "Closed" } as const;
export const deadlineTypeLabels = { report: "Report", deliverable: "Deliverable", contract_expiry: "Contract expiry" } as const;
export const deadlineStatusLabels = { open: "Not started", in_progress: "In progress", completed: "Completed", waived: "Waived" } as const;
export const categoryLabels = {
  w9: "W-9",
  insurance: "Insurance certificate",
  policy: "Policy",
  pnl: "P&L statement",
  executed_contract: "Executed contract",
  award_letter: "Award letter",
  report: "Report",
  other: "Other",
} as const;
export const documentStateLabels: Record<DocumentState, string> = {
  expired: "Overdue",
  review_overdue: "Overdue",
  expiring: "Due soon",
  review_due: "Due soon",
  current: "Current",
};
export const deadlineStateLabels: Record<DeadlineState, string> = { done: "Done", overdue: "Overdue", due_soon: "Due soon", upcoming: "Upcoming" };
export const fileTypeLabels: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

export const reminderChoices = [1, 3, 7, 14, 30, 45, 60, 90];
