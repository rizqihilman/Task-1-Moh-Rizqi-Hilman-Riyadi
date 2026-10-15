# BUG-003 — POST /pet silently replaces a negative pet id

| Field | Value |
|---|---|
| Bug ID | BUG-003 |
| Bug Title | POST /pet accepts `id: -1`, returns 200, but stores a different generated id; the record cannot be retrieved or deleted |
| Endpoint | `POST /pet` |
| Severity | Medium |
| Priority | Medium |
| Status | Open |
| Environment | Swagger Petstore public demo — https://petstore.swagger.io/v2; executed 15 Oct 2026, 09:25 (UTC+7) |
| Related test case | API-POST-010 |

## Preconditions

- Petstore API is reachable.

## Steps to Reproduce

1. `POST /pet` with body `{"id": -1, "name": "QA_NegId_...", "photoUrls": [], "status": "available"}`.
2. Compare the `id` in the response with the `id` that was sent.
3. `GET /pet/-1` (the id that was sent).
4. `GET /pet/{id-returned-by-POST}` (the id the API answered with).

## Request

```
POST /v2/pet
Content-Type: application/json
Accept: application/json

{"id":-1,"name":"QA_NegId_1792031132367","photoUrls":[],"status":"available"}
```

## Expected Result

One of:

- `405 Invalid input` — negative ids are rejected, or
- `200 OK` with the record stored under `id: -1`.

## Actual Result

`200 OK`, but the id in the response is not the id that was sent:

```json
{"id":3174071910010089500,"name":"QA_NegId_1792031132367","photoUrls":[],"tags":[],"status":"available"}
```

- `GET /pet/-1` → `404 Pet not found`
- `GET /pet/3174071910010089500` → `404 Pet not found`

The same behaviour is reproducible across runs (observed ids: `3174071910010089000`, `3174071910010089228`, `3174071910010089500` — a generated sequence in the `3174071910010089xxx` range). The record does appear in `findByStatus` results, so it exists — it just cannot be addressed.

## Response Status Code

`200 OK` (expected `405`, or `200` with the submitted id preserved).

## Evidence

- `evidence/manual-run-log.txt` → case `API-POST-010`
- `evidence/manual-run-results.json` → case `API-POST-010`

## Impact

The caller receives an id that does not match the payload and cannot be used for `GET` or `DELETE`, so the created record cannot be managed. Clients that trust the id they sent will act on a wrong or non-existent resource; clients that use the returned id still cannot read the record back. Because the generated ids look like shared default values, a delete attempt on that id risks touching unrelated records.

## Suggested Fix

Reject ids that are not positive (`405 Invalid input`), or store the submitted id exactly as received.
