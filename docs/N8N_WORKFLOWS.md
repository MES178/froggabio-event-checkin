# n8n workflow contract

The production implementation will contain four workflows. The public PWA calls only the three webhook paths below; the HubSpot credential is attached to n8n HTTP Request nodes and is never exposed to the browser.

## 1. Registration issuance

Trigger: scheduled every 5 minutes while registration is open.

1. Search contacts with `ls2026_status=registered` and an empty `ls2026_token`.
2. Generate a cryptographically random opaque token and a short code.
3. Build a QR image whose payload identifies only `ls2026` and the token.
4. Upload the image to HubSpot Files with restricted, non-indexable access.
5. Update the contact with the token, code, QR URL and registration timestamp.
6. Leave email sending to the approved HubSpot email/workflow so the email remains editable and auditable by the marketing team.

The workflow must be safe to run repeatedly: a contact with a token is skipped, and a retry does not generate a second token.

## 2. `POST /webhook/ls2026/auth`

Request:

```json
{ "event_key": "ls2026", "pin": "…" }
```

Response:

```json
{ "session_token": "opaque-session-token", "expires_at": "2026-10-06T23:00:00-04:00" }
```

The staff PIN is held in an n8n credential, not in workflow JSON or the repository. Sessions expire and are scoped to this event.

## 3. `GET /webhook/ls2026/roster`

Headers: `Authorization: Bearer <session_token>`

Response fields are intentionally minimal:

```json
{
  "event_key": "ls2026",
  "generated_at": "2026-10-06T12:00:00-04:00",
  "contacts": [
    {
      "token": "opaque-token",
      "short_code": "A7K3P9",
      "name": "Guest Name",
      "email": "guest@example.com",
      "company": "Company",
      "jobtitle": "Role",
      "status": "registered",
      "checked_in_at": ""
    }
  ]
}
```

The roster endpoint reads only the Life Science cohort and must never return a HubSpot access token.

## 4. `POST /webhook/ls2026/checkin`

Headers: `Authorization: Bearer <session_token>`

Request:

```json
{
  "event_key": "ls2026",
  "device": "desk-abc123",
  "checkins": [
    {
      "id": "client-event-id",
      "token": "opaque-token",
      "method": "qr",
      "device": "desk-abc123",
      "checked_in_at": "2026-10-06T13:02:00.000Z"
    }
  ]
}
```

The endpoint validates every item, updates only the matching contact, and returns one result per item:

```json
{
  "event_key": "ls2026",
  "results": [
    { "id": "client-event-id", "accepted": true, "status": "attended" }
  ]
}
```

If a contact is already attended, return `status: "already_attended"` with the original timestamp and do not overwrite it. Batch requests are kept small (the PWA normally sends one event; the offline queue sends a bounded batch).

## Credentials and activation

- Existing n8n credential: `HubSpot FroggaBio (service key)` (`hubspotAppToken`).
- Required HubSpot scopes are contact read/write, list read/write if lists are created through the API, and Files upload.
- The staff PIN/header credential and exact Pages origin remain launch configuration items.
- Workflows remain inactive until the HubSpot consent/email decision, Pages origin, venue/time and dry run are complete.
