# WhatsApp Cloud API setup

MedLoop can send family alerts over WhatsApp (medicine, stock/restock, family,
emergency) via Meta's **WhatsApp Cloud API**. The code is production-ready
([worker/src/channels/whatsapp.js](../worker/src/channels/whatsapp.js)); this
guide covers the Meta account setup, the message template to submit, the
secrets, and how to enable it per family member.

> There is also a zero-setup **draft-link** path already in the app
> (`src/lib/whatsapp.js`, `wa.me` links the user reviews and sends). This guide
> is only for the *automatic* Cloud API path.

## 1. Meta WhatsApp Business setup (your account)

1. Create a [Meta Business](https://business.facebook.com/) account and a
   **Meta app** (type "Business") at [developers.facebook.com](https://developers.facebook.com/).
2. Add the **WhatsApp** product. Meta gives you a **test phone number** and a
   temporary token to start.
3. Note the **Phone number ID** (WhatsApp → API Setup).
4. Create a **permanent access token**: Business Settings → Users → **System
   users** → add a system user with the WhatsApp app, generate a token with
   `whatsapp_business_messaging` + `whatsapp_business_management` scopes.
5. Add recipient test numbers (API Setup) until your number is fully registered.

## 2. Set the secrets

```bash
cd worker
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
```

With just these, MedLoop sends **free-form text** — which WhatsApp only delivers
inside the **24-hour window** after the recipient messages your business number.
Good for a first end-to-end test, not for production.

## 3. First test (free-form, no template)

1. From a recipient phone, send any message to your WhatsApp business number
   (opens the 24h window).
2. In MedLoop, enable WhatsApp for that recipient (see §5) and trigger an alert —
   e.g. `POST /v1/jobs/daily-check`, or an SOS confirm.
3. Check `GET /v1/notifications` — the WhatsApp row should be `sent`.

## 4. Production: approved message template

Proactive alerts (sent when no 24h window is open) **require an approved
template**. In Meta → WhatsApp Manager → **Message templates** → Create:

- **Name:** `medloop_alert`
- **Category:** Utility
- **Language:** English
- **Body:**
  ```
  MedLoop: {{1}}. {{2}} Sent automatically on behalf of the account holder.
  ```
- **Sample values:** `{{1}}` = `Low stock: Metformin`, `{{2}}` = `3 tablets left. Please arrange a refill.`

Submit and wait for approval (usually minutes–hours). Then point MedLoop at it —
uncomment in `worker/wrangler.toml`:

```toml
WHATSAPP_TEMPLATE_NAME = "medloop_alert"
WHATSAPP_TEMPLATE_LANG = "en"
```

and redeploy (`npm run deploy`). The channel now sends `type: template` with the
alert's title → `{{1}}` and detail → `{{2}}`. (Change the template name/language
here if you named it differently or add more languages.)

## 5. Who receives WhatsApp

A family member gets WhatsApp when **all** hold:

- the member has a valid `whatsappNumber` (E.164) and `notifyWhatsapp: true`
  — `PATCH /v1/family/:id { "notifyWhatsapp": true, "whatsappNumber": "+91…" }`
- the patient's global switch is on
  — `PATCH /v1/settings { "whatsappEnabled": true }`

Emergencies (SOS confirm) additionally push WhatsApp to every member with a
number when the global switch is on, regardless of the per-member opt-in.

## Notes

- Cost: WhatsApp charges per conversation; utility templates are cheapest. This
  is why WhatsApp is opt-in and secondary to free FCM push.
- Rotate the access token before it expires (system-user tokens can be long
  lived). A failed send is recorded in `notifications` with the Meta error.
