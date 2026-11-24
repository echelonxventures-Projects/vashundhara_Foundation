# Fields, tables, forms and rules

Each NGO can have its own structure without a developer. It applies at once, and one NGO's change never touches another.

## Who can change it

- **Super Admin**: platform console, **Structure**, choose the NGO.
- **NGO Administrator**: only when Super Admin turns on *Let the NGO Administrator change the structure* for that NGO. It then appears in Staff, **Setup**, **Structure**. Super Admin also sets the most fields, tables, forms and rules, and can withdraw the permission at any time.
- **Publishing**: Super Admin reviews and approves each publish. If *Let the NGO Administrator publish without approval* is on for that NGO, its administrator can publish directly. Both switches are off for every NGO until Super Admin turns them on.
- Deleting for good, limits, permissions and templates are always Super Admin only.

## What can be changed

| Part | What it does |
|---|---|
| Extra fields | 14 kinds, on 28 built-in records. Required, unique, searchable, filterable, personal |
| Layout | Rename, hide, require and reorder built-in fields; choose list columns; limit a text field to set choices |
| Own tables | New kinds of record with their own menu entry, screens, export, API and access by role, linked to other records |
| Forms | Public or signed-in pages at `/forms/<name>` that add a row to one of your tables |
| Rules | When a record is added or changed and conditions match: notify a role, email the address on the record, create a CRM task, or call a webhook |
| Templates | Copy one NGO's structure to one, several or all NGOs, or to every new NGO |

## Draft, publish, go back

1. Changes are saved as a draft. Nothing is live.
2. **Publish and history** lists what will change and how many records it affects.
3. A change that would lose data cannot be published, for example text to number while some values are not numbers.
4. Removing a field, choice or table archives it. The data stays and can be restored.
5. **Go back to this** copies an earlier version into the draft.
6. **Delete for good** works only on archived items, asks you to type the name, and cannot be undone. Download the data first.

## Review and approval

1. The NGO Administrator saves a draft and presses **Send for review**. Super Admins get an email, and the NGO appears under **Waiting for your approval** in the console. A draft with problems cannot be sent.
2. Super Admin opens it, sees every change and its effect, and chooses **Approve and publish** or **Send back** with a reason. Super Admin may also edit the draft first.
3. The person who sent it gets an email and a notification.
4. If the NGO edits the draft after sending it, it leaves the queue and must be sent again, so what goes live is exactly what was reviewed.

The history and audit log keep who asked and who approved.

## What stays locked

Donation amounts and status, payments, receipts, refunds, ledger, sign-in, permissions, audit log and consent. Donations, invoices and grant spending accept extra fields only.

## Good to know

- Mark fields that hold personal details as **Personal information**. They stay out of the audit log, are included when a person asks for their data, and are removed when they ask for deletion.
- Extra values are not encrypted separately. Do not store Aadhaar or bank numbers in them.
- Required extra fields apply when staff add a record. Public sign-up, imports and offline field visits are not blocked by them.
- Rules run for the record screens, own tables and forms. They do not run for payments or for approve and reject buttons, and a rule never triggers another rule.
- Field names are in one language. They are not translated.
- Own tables suit up to a few hundred thousand rows each.

## API

`GET /api/v1/structure` lists what you may use. Rows of your own tables are at `/api/v1/records/<table>`; filter with `cf_<field>=value`, sort with `sort=-field`. On built-in records, send and receive extra values under `custom`.
