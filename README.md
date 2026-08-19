# FroggaBio Life Science Check-in

QR-based event check-in for the FroggaBio Life Science event on October 6, 2026.

The static scanner is hosted on GitHub Pages. HubSpot remains the system of record; n8n is the only runtime component that holds the HubSpot service credential. The scanner downloads an authenticated roster into IndexedDB and queues check-ins locally so the desk can continue working when venue Wi-Fi is unreliable.

## Scope

- One event: `ls2026` / October 6, 2026.
- Up to 150 registrations and three scanning devices.
- HubSpot registration, confirmation email, lists, and attendance fields.
- No payment, badge printing, session tracking, attendee mobile app, or October 7 event support.

## Repository layout

- `docs/DECISIONS.md` — confirmed decisions and remaining launch inputs.
- `docs/SETUP.md` — HubSpot, n8n, and GitHub Pages setup.
- `docs/RUNBOOK.md` — rehearsal and event-day instructions.
- `docs/TEST_RESULTS.md` — acceptance test record.
- `n8n/` — credential-stripped workflow exports.

## Security

Do not put a HubSpot token, n8n API key, staff PIN, roster, or test contact data in this repository. The browser app is static and public-facing; all CRM access is proxied through authenticated n8n webhooks.
FroggaBio Life Science event QR check-in system
