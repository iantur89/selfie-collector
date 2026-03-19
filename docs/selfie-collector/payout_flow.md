# Payout flow (user gets paid)

The **payment** stage in this app is **payout setup**: we collect how to pay the user (e.g. PayPal email), not how the user pays us.

## Intended flow (programmatic)

1. After consent is completed, the bot sends a message that includes a **one-time payout-setup link** (e.g. `https://your-app/payout-setup?sessionId=...`).
2. The user opens the link in a browser and sees a short **form** asking for their PayPal email.
3. The user enters their email and submits the form. The app stores it in session state (`payoutEmail`) and marks payout setup complete (`paymentCompleted = true`).
4. The user returns to Telegram; on their next message the agent sees `paymentCompleted` and transitions to **ingest_agent** (selfie upload).

## What is implemented

- **Payout-setup page** (`/payout-setup?sessionId=...`): Form to enter PayPal email; POSTs to `/api/payout-setup`.
- **API** `GET/POST /api/payout-setup`: GET validates the session/link; POST accepts `sessionId` + `payoutEmail`, validates, and updates session (`payoutEmail`, `paymentCompleted`, `paymentStatus: 'paid'`).
- **Consent webhook**: After sending the A3 “consent complete” reply, appends the payout-setup link to the Telegram message so the user gets one message with the link.
- **Payment agent prompt**: Tells the LLM to direct users to the link/form, not to type their email in chat.
- **State**: `payoutEmail`, `paymentCompleted`, and `payoutBatchId` (set after a real payout to avoid double-paying).
- **Fallback (chat)**: If the user types something that looks like an email while in `payment_agent`, the Telegram handler still saves it and marks complete (so the link is optional).

## Real payouts (PayPal Payouts API)

- When the user reaches **completion_agent**, the app automatically sends the default amount ($5 USD) to their stored `payoutEmail`. Session stores `payoutBatchId` to avoid double-paying. Manual trigger: `POST /api/payouts/execute` with `{ "sessionId": "tg-123", "amount": 5, "currency": "USD" }`. Enable **Payouts** in your PayPal Developer app.
- **Payment webhook**: `/api/webhooks/payment` still reflects the old “user pays us” flow (PayPal checkout completion). It is not used for the current “we pay the user” flow; payout is completed when the user sends their email in chat.

## Summary

| Step              | Who          | Action                                      |
|-------------------|-------------|---------------------------------------------|
| After consent     | Bot         | “Please send your PayPal email for payouts.”|
| User replies      | User        | Sends email in Telegram.                    |
| App               | Handler     | Saves `payoutEmail`, sets `paymentCompleted`.|
| Next turn         | A3          | Transitions to ingest; bot asks for selfies.|
| After completion  | App         | Sends payout via PayPal Payouts API; stores `payoutBatchId`.|
