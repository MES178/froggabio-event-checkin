# Event runbook

## Before the event

1. Confirm the exact city, venue, registration opening/closing time, local timezone and the privacy/marketing consent wording.
2. Confirm the HubSpot form is published and the QR email/workflow is approved.
3. Open the GitHub Pages URL on all three registration devices.
4. Enter the staff PIN on each device and refresh the roster while online.
5. Confirm each device shows the same roster count, then test one QR scan and one manual lookup.
6. Keep one printed/exported fallback list at the desk. Do not put HubSpot tokens or API credentials on paper.

## At the desk

- Prefer QR scanning. Use name/email/company/short code search when a guest cannot show the QR.
- If the connection chip turns orange, continue checking guests in. The queue count shows unsent events on that device.
- Do not clear site data, browser storage or the application cache during the event.
- If a duplicate is shown, pause and verify the guest before making any manual correction in HubSpot.

## After the event

1. Reconnect every device and wait until its queue count is zero.
2. Refresh the roster and verify the HubSpot attended list/report.
3. Lock each desk.
4. Export the final attendance report from HubSpot according to FroggaBio’s retention policy.
5. Deactivate the event workflows after the reporting window and remove the event origin from the n8n CORS allow-list when no longer needed.

## Emergency fallback

If the PWA or n8n service is unavailable, record name, company and email on the paper list. After the event, reconcile the paper list in HubSpot manually; do not attempt to paste credentials or tokens into a public form.
