import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { Tx } from "@/db/client";
import { organizationProfile } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { organizationInput } from "@/lib/validation/organization";
import { asMember, asWriter, type Identity } from "./identity";

export function getOrganization(identity: Identity) {
  return asMember(identity, async (tx) => {
    const [profile] = await tx.select().from(organizationProfile);
    return profile ?? null;
  });
}

export function saveOrganization(identity: Identity, input: z.input<typeof organizationInput>) {
  const values = organizationInput.parse(input);
  return asWriter(identity, async (tx) => {
    const updated = await tx.update(organizationProfile).set(values).where(eq(organizationProfile.id, 1)).returning();
    if (updated[0]) return updated[0];
    const [created] = await tx.insert(organizationProfile).values(values).returning();
    return created!;
  });
}

export async function organizationToday(tx: Tx): Promise<string> {
  const [profile] = await tx.select({ timezone: organizationProfile.timezone }).from(organizationProfile);
  return todayIn(profile?.timezone ?? "America/New_York");
}
