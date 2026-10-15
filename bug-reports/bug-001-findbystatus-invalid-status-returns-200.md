# BUG-001 — GET /pet/findByStatus returns 200 for an invalid or missing status instead of 400

| Field | Value |
|---|---|
| Bug ID | BUG-001 |
| Bug Title | findByStatus accepts an invalid or missing `status` parameter and returns 200 with an empty array instead of 400 |
| Endpoint | `GET /pet/findByStatus` |
| Severity | Low |
| Priority | Medium |
| Status | Open |
| Environment | Swagger Petstore public demo — https://petstore.swagger.io/v2; executed 15 Oct 2026, 09:25 (UTC+7) |
| Related test cases | API-GET-005, API-GET-006 |

## Preconditions

- Petstore API is reachable.

## Steps to Reproduce

1. Send `GET https://petstore.swagger.io/v2/pet/findByStatus?status=notastatus`.
2. Observe the status code and body.
3. Send `GET https://petstore.swagger.io/v2/pet/findByStatus` (no `status` parameter).
4. Observe the status code and body.

## Request

```
GET /v2/pet/findByStatus?status=notastatus
Accept: application/json
```

```
GET /v2/pet/findByStatus
Accept: application/json
```

## Expected Result

- Invalid value: `400 Invalid status value` (per the Swagger documentation).
- Missing value: `400` — `status` is documented as a required query parameter.

## Actual Result

| Request | Response | Body |
|---|---|---|
| `?status=notastatus` | `200 OK` | `[]` |
| no parameter | `200 OK` | `[]` |

The invalid value is simply used as a filter string. During exploration, a pet created with the non-enum status `sleepy` was also returned by `?status=sleepy`, which confirms there is no enum validation at all on this parameter.

## Response Status Code

`200 OK` (expected `400`).

## Evidence

- `evidence/manual-run-log.txt` → cases `API-GET-005`, `API-GET-006`
- `evidence/manual-run-results.json` → same case IDs

## Impact

A client that sends a typo or an unsupported status value gets a valid-looking empty result instead of an error. The bug is silent: consumers cannot distinguish "no pets match" from "your request was wrong", and can show wrong data to end users.

## Suggested Fix

Validate `status` against the enum (`available`, `pending`, `sold`) and return `400 Invalid status value` for unknown values; reject requests where the parameter is missing.
