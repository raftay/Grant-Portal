import type { z } from "zod";
import type { Tx } from "@/db/client";
import { organizationProfile } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { one } from "@/lib/one";
import { organizationInput } from "@/lib/validation/organization";
import { asMember, asWriter, type Identity } from "./identity";

export function getOrganization(identity: Identity) {
  return asMember(identity, async (tx) => {
    return one(await tx.select().from(organizationProfile));
  });
}

export function saveOrganization(identity: Identity, input: z.input<typeof organizationInput>) {
  const values = organizationInput.parse(input);
  return asWriter(identity, async (tx) => {
    const saved = await tx
      .insert(organizationProfile)
      .values(values)
      .onConflictDoUpdate({ target: organizationProfile.id, set: values })
      .returning();
    return one(saved);
  });
}

export async function organizationToday(tx: Tx, now: Date = new Date()): Promise<string> {
  return todayIn(one(await tx.select({ timezone: organizationProfile.timezone }).from(organizationProfile)).timezone, now);
}
