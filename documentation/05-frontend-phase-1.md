# Frontend, Phase 1

## Screens

| Route | Who | Content |
|---|---|---|
| `/login`, `/forgot-password`, `/reset-password/…`, `/accept-invite/…` | Anyone | Sign-in by password or link, reset, joining |
| `/` | Members | Totals, grants, Needs attention, recent activity |
| `/organisation`, `/organisation/documents` | Members | Profile with Copy buttons, document library |
| `/organisation/edit` | Admin, Staff | Edit profile |
| `/documents/{id}` | Members | Details, versions, preview; editors can replace and archive |
| `/grants`, `/grants/{id}` | Members | List, overview |
| `/grants/{id}/documents`, `/deadlines`, `/contacts` | Members | Grant tabs |
| `/grants/new`, `/grants/{id}/edit`, `/grants/{id}/contract` | Admin, Staff | Grant form, contract upload, AI review |
| `/deadlines` | Members | All deadlines with filters and an edit panel |
| `/settings/people`, `/settings/audit` | Admin | People and access, audit log |
| `/settings/outbox` | Admin, outbox mode | Demo inbox, run alerts now |

People who may not use a page see "Not found". Hiding a control is for clarity; the database refuses the action.

## Design rules

- Colours and type live in `src/app/globals.css`. Components are shadcn/ui with the theme applied.
- Purple means "suggested by AI". A suggestion shows its quote and page, and saving needs the "reviewed" box.
- Dates read like 30 Nov 2026 and money like $150,000.
- Tables become stacked cards below 768px. The sidebar becomes a menu plus three bottom tabs.
- Every page passes automated WCAG 2.1 A and AA checks at 375px and 1440px. Automated checks do not cover everything.

## The paper loader

`PaperLoader` shows papers spinning in, stacking up, being stamped with a dollar seal and filed away.

| Use | How |
|---|---|
| Page loading | `size="lg"` in `loading.tsx` |
| AI reading | `size="md"` with a label |
| Buttons and small changes | `size="xs"` |
| Upload progress | Pass `progress` from 0 to 1; the stack grows and is stamped at 100% |

It is CSS only, announces itself to screen readers, and stays still for people who prefer reduced motion.

## Forms

`ActionForm` submits to a server action, shows errors beside fields and keeps what was typed. Expected problems become messages; anything else reaches the error page.
