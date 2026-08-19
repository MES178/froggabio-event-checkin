# Life Science Check-in — Decisions

Updated: 2026-08-19

## Confirmed

| Item | Decision |
|---|---|
| Scope | Life Science event on October 6, 2026 only. The October 7 event is out of scope. |
| Event key | `ls2026` |
| Expected registrations | Fewer than 150 |
| HubSpot tier | Marketing Hub Professional |
| Registration | Use the existing HubSpot form if it is suitable; otherwise create a dedicated form. |
| Confirmation | Registration and confirmation email through HubSpot. |
| Automation | n8n Cloud; HubSpot credential is already present in n8n. |
| Scanning devices | Up to three phones/tablets operated by staff. |
| Offline mode | Required; the roster is downloaded before doors open. |
| Persistence | Do not add Supabase unless n8n cannot provide durable session/idempotency storage. |
| Repository | `MES178/froggabio-event-checkin` (created as private). |
| Post-launch owner | Eugene Martynov for now; a second operator is still needed before launch. |
| Dry run | Immediately after the first working build, with at least five test participants on three devices. |

## Working defaults to confirm

| Item | Current value | Needed before production |
|---|---|---|
| Event timezone | `US/Eastern` (matches the HubSpot portal timezone) | Confirm that the venue is in this timezone. |
| City and venue | TBD | Exact city and venue name. |
| Registration opening time | TBD | Local start/end time for the registration desk. |
| Staff PIN | TBD | Set a PIN in n8n credentials before dry run. |
| GitHub Pages visibility | Private repository initially | Confirm GitHub Pro/Team availability or approve making the code repository public. |
| Second operator | TBD | Name/account before launch. |

## Existing access findings

- HubSpot portal: `39925748`; Contacts read/write available through the connected CRM access.
- The eight `ls2026_*` contact properties already exist with the specified types and options.
- n8n Cloud API is reachable; the existing credential is named `HubSpot FroggaBio (service key)`.
- GitHub account `MES178` has admin/push access; Pages is not yet enabled on the new repository.

## Security decisions

- The HubSpot service key remains only in n8n credentials at runtime.
- GitHub Pages contains no HubSpot credentials, tokens, roster, or attendee data.
- The scanner calls n8n webhooks only; it never calls `api.hubapi.com` directly.
- n8n workflow exports committed to GitHub must have credentials stripped.

