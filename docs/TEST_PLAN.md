# Dry-run acceptance plan

Run this immediately after the first n8n and HubSpot configuration pass.

## Test data

- One test contact created through the approved HubSpot registration form.
- Four additional test contacts or existing registrations for the roster and duplicate tests.
- Three separate devices using the published Pages URL.

## Checks

1. Form submission creates or updates the expected contact and registration status.
2. QR issuance adds the token, short code and QR URL exactly once.
3. The registration email displays a scannable QR and the correct event label.
4. Each device can authenticate and load the same roster.
5. A QR scan records `attended`, method `qr`, device ID and the first timestamp.
6. A manual lookup records method `manual_search`.
7. Repeating a scan returns the original timestamp and does not overwrite it.
8. Turning off network access queues a check-in; restoring access drains the queue.
9. An invalid event key, expired session and unknown token are rejected.
10. No HubSpot/n8n credential appears in page source, local storage, IndexedDB roster data or network responses sent to the browser.
