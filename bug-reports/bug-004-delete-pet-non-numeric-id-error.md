# BUG-004 — DELETE /pet/{petId} with a non-numeric id returns 404 and leaks an internal exception message

| Field | Value |
|---|---|
| Bug ID | BUG-004 |
| Bug Title | Non-numeric petId returns 404 with a raw java.lang.NumberFormatException message instead of the documented 400 Invalid ID |
| Endpoint | `DELETE /pet/{petId}` |
| Severity | Low |
| Priority | Low |
| Status | Open |
| Environment | Swagger Petstore public demo — https://petstore.swagger.io/v2; executed 15 Oct 2026, 09:25 (UTC+7) |
| Related test case | API-DELETE-005 |

## Preconditions

- Petstore API is reachable.

## Steps to Reproduce

1. Send `DELETE https://petstore.swagger.io/v2/pet/abc`.
2. Observe the status code and body.

## Request

```
DELETE /v2/pet/abc
Accept: application/json
```

## Expected Result

`400 Invalid ID supplied` — `abc` is not a valid pet id (documented behaviour).

## Actual Result

`404 Not Found` with an internal exception message in the body:

```json
{"code":404,"type":"unknown","message":"java.lang.NumberFormatException: For input string: \"abc\""}
```

## Response Status Code

`404 Not Found` (expected `400`).

## Evidence

- `evidence/manual-run-log.txt` → case `API-DELETE-005`
- `evidence/manual-run-results.json` → case `API-DELETE-005`

## Impact

Low functional impact — no data is changed. Two quality issues though: the wrong status code makes client-side error handling harder (400 vs 404 usually means different things), and the response exposes an internal Java class name. It also makes the endpoint's 404 body format inconsistent: numeric unknown ids return an empty body (`API-DELETE-004`, `API-DELETE-006`), non-numeric ids return a JSON error.

## Suggested Fix

Validate the path parameter before it reaches the persistence layer and return `400 Invalid ID supplied` with a stable error body; avoid returning raw exception messages to clients.
