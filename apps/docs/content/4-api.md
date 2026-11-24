# API

Base address `https://api.<domain>/api/v1`. Create a key under Staff, API keys, and send it as `x-api-key`. A key acts only in its own NGO and never has more access than the person who made it.

Lists accept `page`, `limit` (up to 100), `q` and `sort` (prefix `-` for descending). Money is a whole number of paise. Errors look like `{ "error": { "code", "message", "details" }, "requestId" }`.

## Webhooks

Each delivery has `x-vf-signature: t=<unix time>,v1=<hex>`, the HMAC-SHA256 of `<t>.<raw body>` with your secret. Check it, refuse old timestamps, and expect repeats: use `x-vf-delivery` to ignore them.
