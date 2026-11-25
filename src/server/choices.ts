import { categoryLabels } from "@/lib/labels";
import type { Identity } from "./services/identity";
import { listOwners } from "./services/users";

export async function ownerChoices(identity: Identity) {
  return (await listOwners(identity)).map((owner) => ({ value: owner.id, label: owner.name }));
}

export const choicesFrom = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export const organizationCategories = choicesFrom(categoryLabels).filter((choice) => choice.value !== "executed_contract");
export const grantCategories = choicesFrom(categoryLabels).filter((choice) => !["w9", "pnl", "executed_contract"].includes(choice.value));
