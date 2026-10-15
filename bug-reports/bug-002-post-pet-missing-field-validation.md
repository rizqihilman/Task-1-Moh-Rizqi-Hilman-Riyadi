# BUG-002 — POST /pet does not validate the request body

| Field | Value |
|---|---|
| Bug ID | BUG-002 |
| Bug Title | POST /pet accepts an empty payload, payloads missing required fields, and status values outside the documented enum |
| Endpoint | `POST /pet` |
| Severity | Medium |
| Priority | Medium |
| Status | Open |
| Environment | Swagger Petstore public demo — https://petstore.swagger.io/v2; executed 15 Oct 2026, 09:25 (UTC+7) |
| Related test cases | API-POST-004, API-POST-005, API-POST-006, API-POST-008 |

## Preconditions

- Petstore API is reachable.
- Per the documented Pet schema, `name` and `photoUrls` are required and `status` only allows `available`, `pending`, `sold`. Invalid input should return `405 Invalid input`.

## Steps to Reproduce

1. `POST /pet` with body `{}`.
2. `POST /pet` with body `{"id": 311323675, "photoUrls": ["https://example.com/qa-x.jpg"], "status": "available"}` (no `name`).
3. `POST /pet` with body `{"id": 311323676, "name": "QA_NoPhoto_...", "status": "available"}` (no `photoUrls`).
4. `POST /pet` with body `{"id": 311323678, "name": "QA_BadStatus_...", "photoUrls": [], "status": "sleepy"}`.
5. For case 4, follow up with `GET /pet/311323678` to check what was stored.

## Request

```
POST /v2/pet
Content-Type: application/json
Accept: application/json

{}
```

(and the three payloads listed above)

## Expected Result

`405 Invalid input` for all four requests — required fields are missing or the enum value is not allowed.

## Actual Result

All four requests return `200 OK` and create records:

| Case | Request body | Response |
|---|---|---|
| Empty body | `{}` | `200` → `{"id":3174071910010089253,"photoUrls":[],"tags":[]}` — record with no name and a generated id |
| Missing `name` | id + photoUrls + status | `200` → pet created without a name |
| Missing `photoUrls` | id + name + status | `200` → `photoUrls` silently defaulted to `[]` |
| Invalid enum | `status: "sleepy"` | `200` → stored as-is; `GET /pet/311323678` returns `status: "sleepy"` |

## Response Status Code

`200 OK` (expected `405`).

## Evidence

- `evidence/manual-run-log.txt` → cases `API-POST-004`, `API-POST-005`, `API-POST-006`, `API-POST-008`
- `evidence/manual-run-results.json` → same case IDs

## Impact

Invalid records are persisted in the shared public dataset and are visible to every consumer of `findByStatus` (for example, a nameless pet with no `photoUrls`). This is a data-integrity problem, not just a cosmetic one: any client can pollute the dataset with records that break the documented contract.

## Suggested Fix

Validate the request body before persisting: return `405 Invalid input` when `name` or `photoUrls` is missing, and reject `status` values outside `available | pending | sold`.
