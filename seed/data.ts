export const people = [
  { key: "alex", name: "Alex Morgan", email: "alex@example.org", role: "admin", payroll: true },
  { key: "jamie", name: "Jamie Lee", email: "jamie@example.org", role: "staff", payroll: true },
  { key: "sam", name: "Sam Rivera", email: "sam@example.org", role: "staff", payroll: false },
  { key: "taylor", name: "Taylor Brooks", email: "taylor@example.org", role: "viewer", payroll: false },
] as const;

export type Person = (typeof people)[number]["key"];

type SeedDeadline = { title: string; type: "report" | "deliverable" | "contract_expiry"; days: number; owner: Person; status?: "open" | "in_progress" };
type SeedGrant = {
  name: string;
  code: string;
  funder: string;
  dollars: number;
  owner: Person;
  purpose: string;
  contact: { name: string; title: string; email: string; phone: string };
  deadlines: SeedDeadline[];
};

export const grants: SeedGrant[] = [
  {
    name: "Community wellbeing",
    code: "CW",
    funder: "Evergreen Foundation",
    dollars: 150_000,
    owner: "jamie",
    purpose: "Community outreach and wellbeing programmes",
    contact: { name: "Morgan Chen", title: "Programme Officer", email: "morgan@example.org", phone: "(202) 555-0148" },
    deadlines: [
      { title: "Quarterly impact report", type: "report", days: 5, owner: "jamie", status: "in_progress" },
      { title: "Community workshop summary", type: "deliverable", days: 15, owner: "sam" },
      { title: "Contract expiry", type: "contract_expiry", days: 36, owner: "jamie" },
    ],
  },
  {
    name: "Youth pathways",
    code: "YP",
    funder: "Northstar Trust",
    dollars: 120_000,
    owner: "sam",
    purpose: "Mentoring and skills for young people",
    contact: { name: "Robin Patel", title: "Grants Manager", email: "robin@example.org", phone: "(202) 555-0163" },
    deadlines: [{ title: "Youth participation summary", type: "deliverable", days: 27, owner: "jamie" }],
  },
  {
    name: "Food security",
    code: "FS",
    funder: "Community Fund",
    dollars: 100_000,
    owner: "alex",
    purpose: "Pantry supplies and delivery",
    contact: { name: "Casey Nguyen", title: "Fund Officer", email: "casey@example.org", phone: "(202) 555-0117" },
    deadlines: [{ title: "Quarterly spending report", type: "report", days: 23, owner: "alex" }],
  },
  {
    name: "Housing stability",
    code: "HS",
    funder: "Civic Partnership",
    dollars: 90_000,
    owner: "jamie",
    purpose: "Rent support and tenancy advice",
    contact: { name: "Drew Okafor", title: "Contract Lead", email: "drew@example.org", phone: "(202) 555-0182" },
    deadlines: [{ title: "Annual tenancy report", type: "report", days: 64, owner: "jamie" }],
  },
  {
    name: "Digital inclusion",
    code: "DI",
    funder: "Bridge Foundation",
    dollars: 80_000,
    owner: "sam",
    purpose: "Devices, connectivity and training",
    contact: { name: "Jordan Silva", title: "Programme Manager", email: "jordan@example.org", phone: "(202) 555-0139" },
    deadlines: [{ title: "Device distribution log", type: "deliverable", days: 48, owner: "sam" }],
  },
  {
    name: "Capacity building",
    code: "CB",
    funder: "Oak Giving Fund",
    dollars: 60_000,
    owner: "alex",
    purpose: "Staff training and systems",
    contact: { name: "Avery Stone", title: "Trustee", email: "avery@example.org", phone: "(202) 555-0155" },
    deadlines: [{ title: "Training outcomes report", type: "report", days: 91, owner: "alex" }],
  },
];

export const documents = [
  { title: "W-9", category: "w9", owner: "alex", expires: null, review: 36, lines: ["Request for taxpayer identification number.", "Harbor Community Initiative."] },
  { title: "Insurance certificate", category: "insurance", owner: "alex", expires: -2, review: null, lines: ["General liability certificate of insurance."] },
  { title: "Safeguarding policy", category: "policy", owner: "sam", expires: null, review: 20, lines: ["This policy protects everyone who uses our services."] },
  { title: "P&L statement", category: "pnl", owner: "jamie", expires: null, review: 126, lines: ["Profit and loss, year to date.", "Illustrative figures only."] },
] as const;
