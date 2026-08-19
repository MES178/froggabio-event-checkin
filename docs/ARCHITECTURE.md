# Life Science check-in architecture

## Scope

This system is for the FroggaBio Life Science event on **October 6, 2026** only. The October 7 event is deliberately outside the application scope. Expected attendance is below 150 people and the desk supports up to three staff devices.

## Data flow

```text
HubSpot form
     │
     ▼
HubSpot contact (registered)
     │  n8n scheduled issuance workflow
     ├── create token + short code
     ├── create QR image
     ├── upload image to HubSpot Files
     └── update contact properties
             │
             ▼
      HubSpot registration email/workflow
      (contact receives QR)

Staff device (GitHub Pages PWA)
     │  HTTPS only
     ▼
n8n Cloud webhooks
     ├── authenticate staff PIN
     ├── return a minimal roster
     └── record first check-in timestamp
             │
             ▼
HubSpot contact properties + attended reporting list
```

## Security boundaries

- HubSpot credentials stay in n8n. They are never bundled into the static site, QR payload, browser storage, or GitHub repository.
- The QR contains an opaque event token, not an email address or other personal data.
- The PWA stores only the minimum roster needed at the door in IndexedDB and stores unsent check-ins in a local queue.
- n8n validates the event key, session, token, method and device; the check-in endpoint is idempotent and preserves the first arrival timestamp.
- Production CORS must allow only the final GitHub Pages origin, not `*`.
- The registration form and email must use FroggaBio-approved privacy/marketing consent language before publication.

## HubSpot fields

The following contact properties already exist in the portal and are used by the system:

| Property | Purpose |
| --- | --- |
| `ls2026_token` | Opaque QR token |
| `ls2026_short_code` | Human-readable fallback code |
| `ls2026_qr_url` | HubSpot Files URL used by the registration email |
| `ls2026_registered_at` | Registration timestamp |
| `ls2026_status` | `registered`, `attended` or `cancelled` |
| `ls2026_checked_in_at` | First successful check-in timestamp |
| `ls2026_checkin_method` | `qr`, `manual_search` or `short_code` |
| `ls2026_checkin_device` | Device identifier for audit |

## Intentionally not used

Supabase is not part of the baseline design. n8n and HubSpot provide the server-side integration, while IndexedDB provides the small offline cache. Supabase should be added only if a live test proves that n8n Cloud cannot provide the required session/idempotency durability.
