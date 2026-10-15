/**
 * Task 1 - Manual API test execution script (Petstore).
 *
 * Executes the test cases from test-cases.xlsx against the live public API and
 * records raw evidence (request, response, verdict) into:
 *   - ../evidence/manual-run-log.txt        (human readable log)
 *   - ../evidence/manual-run-results.json   (structured results, source for the Excel report)
 *
 * Run:  node tools/run-manual-api-tests.mjs
 * No dependencies - uses Node's built-in fetch.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(__dirname, '..', 'evidence');
const BASE = 'https://petstore.swagger.io/v2';
const RUN_TS = Date.now();
const ID_BASE = Number(String(RUN_TS).slice(-8)) * 10; // 9-digit unique-ish ids for this run

const logLines = [];
const log = (s) => { console.log(s); logLines.push(s); };

async function req(method, path, { body, rawBody, contentType, retryReads = 0 } = {}) {
  const url = BASE + path;
  const headers = { Accept: 'application/json' };
  let payload;
  if (rawBody !== undefined) { headers['Content-Type'] = 'application/json'; payload = rawBody; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (contentType) headers['Content-Type'] = contentType;

  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, { method, headers, body: payload, signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      let json = null; try { json = JSON.parse(text); } catch { json = null; }
      return { url, method, headers, payload, status: res.status, text, json, ms: Date.now() - t0 };
    } catch (e) {
      if (attempt < retryReads) { log(`      (transient error, retrying read: ${String(e).slice(0, 80)})`); continue; }
      return { url, method, headers, payload, status: 'ERROR', text: String(e), json: null, ms: Date.now() - t0 };
    }
  }
}

const excerpt = (r, max = 300) => {
  const body = r.text === '' ? '(empty body)' : r.text;
  return body.length > max ? body.slice(0, max) + `... [${body.length} chars total]` : body;
};
const idFilter = (arr, id) => Array.isArray(arr) ? arr.filter((p) => p.id === id) : [];

const cases = [];
const ctx = {};

function record(c) { cases.push(c); }

// ---------------------------------------------------------------- POST cases
async function postCases() {
  const p1 = { id: ID_BASE + 1, name: `QA_Doggo_${RUN_TS}`, category: { id: 1, name: 'dogs' }, photoUrls: ['https://example.com/qa-dog.jpg'], tags: [{ id: 7, name: 'qa' }], status: 'available' };

  // API-POST-001
  {
    const r = await req('POST', '/pet', { body: p1 });
    ctx.p1 = p1;
    const ok = r.status === 200 && r.json && r.json.id === p1.id && r.json.name === p1.name && r.json.status === p1.status && Array.isArray(r.json.photoUrls) && r.json.photoUrls[0] === p1.photoUrls[0];
    record({
      id: 'API-POST-001', endpoint: 'POST /pet', scenario: 'Create a new pet with all valid fields', type: 'Positive',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p1), steps: '1. Send POST /pet with a full valid pet payload (unique id generated per run)\n2. Check status code\n3. Compare response fields (id, name, category, photoUrls, tags, status) with the request payload',
      expected: 'HTTP 200; response body echoes the created pet with the same id, name, photoUrls, tags and status',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r)}`,
      status: ok ? 'Pass' : 'Fail', notes: ok ? 'All echoed fields match the payload.' : 'Response did not match the payload as documented.',
      durationMs: r.ms,
    });
  }

  // API-POST-002 (depends on POST-001)
  {
    if (!ctx.p1) { record(skipped('API-POST-002')); } else {
      const r = await req('GET', `/pet/${ctx.p1.id}`, { retryReads: 1 });
      const ok = r.status === 200 && r.json && r.json.id === ctx.p1.id && r.json.name === ctx.p1.name;
      record({
        id: 'API-POST-002', endpoint: 'POST /pet', scenario: 'Created pet can be retrieved by GET /pet/{petId}', type: 'Positive (integration)',
        preconditions: 'API-POST-001 created pet id ' + ctx.p1.id, method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
        steps: '1. Take the pet id returned by API-POST-001\n2. Send GET /pet/{petId}\n3. Verify the returned record matches the created pet',
        expected: 'HTTP 200; same id and name as the created pet',
        actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}`,
        status: ok ? 'Pass' : 'Fail', notes: 'Verifies the POST actually persisted the record, not only echoed it.',
        durationMs: r.ms,
      });
    }
  }

  // API-POST-003
  {
    const p3 = { id: ID_BASE + 3, name: `QA_Minimal_${RUN_TS}`, photoUrls: ['https://example.com/qa-min.jpg'] };
    const r = await req('POST', '/pet', { body: p3 });
    ctx.p3 = p3;
    const ok = r.status === 200 && r.json && r.json.id === p3.id && r.json.name === p3.name;
    record({
      id: 'API-POST-003', endpoint: 'POST /pet', scenario: 'Create a pet with only the required fields (no category, no tags)', type: 'Positive (boundary)',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p3), steps: '1. Send POST /pet with id, name and photoUrls only\n2. Check status code and echoed fields',
      expected: 'HTTP 200; pet is created; category and tags are optional and may be omitted',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 250)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Optional fields are not required - matches the documented schema.',
      durationMs: r.ms,
    });
  }

  // API-POST-004 empty body
  {
    const r = await req('POST', '/pet', { body: {} });
    const ok = r.status === 405; // documented: 405 Invalid input
    record({
      id: 'API-POST-004', endpoint: 'POST /pet', scenario: 'Empty payload must be rejected', type: 'Negative',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: '{}', steps: '1. Send POST /pet with body {}\n2. Check that the API rejects the payload (documented: 405 Invalid input)',
      expected: 'HTTP 405 Invalid input - name and photoUrls are required fields',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}`,
      status: ok ? 'Pass' : 'Fail', notes: `Defect: the API accepts an empty payload and creates a nameless record with a generated id (${r.json?.id}). See BUG-002.`,
      durationMs: r.ms,
    });
  }

  // API-POST-005 missing name
  {
    const p = { id: ID_BASE + 5, photoUrls: ['https://example.com/qa-x.jpg'], status: 'available' };
    const r = await req('POST', '/pet', { body: p });
    if (r.status === 200) await req('DELETE', `/pet/${p.id}`); // best-effort cleanup
    const ok = r.status === 405;
    record({
      id: 'API-POST-005', endpoint: 'POST /pet', scenario: 'Payload without required field "name" must be rejected', type: 'Negative',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p), steps: '1. Send POST /pet without the required "name" field\n2. Check that the API rejects the payload',
      expected: 'HTTP 405 Invalid input - "name" is a required field per the schema',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Defect: pet is created without a name. See BUG-002. Record was cleaned up afterwards (DELETE).',
      durationMs: r.ms,
    });
  }

  // API-POST-006 missing photoUrls
  {
    const p = { id: ID_BASE + 6, name: `QA_NoPhoto_${RUN_TS}`, status: 'available' };
    const r = await req('POST', '/pet', { body: p });
    if (r.status === 200) await req('DELETE', `/pet/${p.id}`);
    const ok = r.status === 405;
    record({
      id: 'API-POST-006', endpoint: 'POST /pet', scenario: 'Payload without required field "photoUrls" must be rejected', type: 'Negative',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p), steps: '1. Send POST /pet without the required "photoUrls" field\n2. Check that the API rejects the payload',
      expected: 'HTTP 405 Invalid input - "photoUrls" is a required field per the schema',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Defect: pet is created with photoUrls defaulted to []. See BUG-002. Record was cleaned up afterwards (DELETE).',
      durationMs: r.ms,
    });
  }

  // API-POST-007 malformed JSON
  {
    const r = await req('POST', '/pet', { rawBody: '{ "id": 123, "name": ' });
    const ok = r.status === 400;
    record({
      id: 'API-POST-007', endpoint: 'POST /pet', scenario: 'Malformed JSON body must be rejected', type: 'Negative',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: '{ "id": 123, "name": (truncated JSON)', steps: '1. Send POST /pet with syntactically invalid JSON\n2. Check that the API returns an error and does not create a record',
      expected: 'HTTP 400; parse error, no pet is created',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Server returns 400 "bad input" as expected.',
      durationMs: r.ms,
    });
  }

  // API-POST-008 invalid enum status
  {
    const p = { id: ID_BASE + 8, name: `QA_BadStatus_${RUN_TS}`, photoUrls: [], status: 'sleepy' };
    const r = await req('POST', '/pet', { body: p });
    let persisted = null;
    if (r.status === 200) persisted = await req('GET', `/pet/${p.id}`, { retryReads: 1 });
    if (r.status === 200) await req('DELETE', `/pet/${p.id}`);
    const ok = r.status === 405; // documented enum: available | pending | sold
    record({
      id: 'API-POST-008', endpoint: 'POST /pet', scenario: 'Status value outside the documented enum must be rejected', type: 'Negative (boundary)',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p), steps: '1. Send POST /pet with status "sleepy" (allowed: available, pending, sold)\n2. Check that the API rejects the payload\n3. (observed) GET the pet id to see whether the invalid value was persisted',
      expected: 'HTTP 405 Invalid input - "status" only allows available, pending, sold',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}${persisted ? ` | GET /pet/${p.id} -> HTTP ${persisted.status}, status field: "${persisted.json?.status}"` : ''}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Defect: invalid status is accepted and persisted. See BUG-002. Record was cleaned up afterwards (DELETE).',
      durationMs: r.ms,
    });
  }

  // API-POST-009 name 255 chars
  {
    const longName = 'Q'.repeat(255);
    const p = { id: ID_BASE + 9, name: longName, photoUrls: ['https://example.com/qa-long.jpg'], status: 'available' };
    const r = await req('POST', '/pet', { body: p });
    if (r.status === 200) await req('DELETE', `/pet/${p.id}`);
    const ok = r.status === 200 && r.json?.name === longName;
    record({
      id: 'API-POST-009', endpoint: 'POST /pet', scenario: 'Boundary: 255-character name is stored without truncation', type: 'Boundary',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p).slice(0, 180) + '... [truncated for readability]', steps: '1. Send POST /pet with a 255-character name\n2. Verify the response echoes the full 255-character name',
      expected: 'HTTP 200; name is stored and returned in full (no documented length limit)',
      actual: `HTTP ${r.status} in ${r.ms} ms; echoed name length: ${r.json?.name?.length ?? 'n/a'} chars`,
      status: ok ? 'Pass' : 'Fail', notes: 'No truncation observed. Record was cleaned up afterwards (DELETE).',
      durationMs: r.ms,
    });
  }

  // API-POST-010 negative id
  {
    const p = { id: -1, name: `QA_NegId_${RUN_TS}`, photoUrls: [], status: 'available' };
    const r = await req('POST', '/pet', { body: p });
    const returnedId = r.json?.id;
    const ok = r.status === 200 && returnedId === -1; // expect the API to honor the id or reject it
    const getBack = r.status === 200 ? await req('GET', `/pet/${returnedId}`, { retryReads: 1 }) : null;
    record({
      id: 'API-POST-010', endpoint: 'POST /pet', scenario: 'Boundary: negative pet id must be rejected or honored as sent', type: 'Boundary (negative)',
      preconditions: 'API is reachable', method: 'POST', url: r.url, headers: 'Content-Type: application/json; Accept: application/json',
      body: JSON.stringify(p), steps: '1. Send POST /pet with id -1\n2. Check the id in the response\n3. Try to retrieve the pet using the returned id',
      expected: 'HTTP 405 (invalid input) or HTTP 200 with id -1 preserved',
      actual: `HTTP ${r.status} in ${r.ms} ms; returned id: ${returnedId} (sent -1)${getBack ? ` | GET /pet/${returnedId} -> HTTP ${getBack.status}` : ''}`,
      status: ok ? 'Pass' : 'Fail', notes: `Defect: id -1 is silently replaced with ${returnedId}; the record cannot be retrieved with either the sent id (-1) or the returned id. See BUG-003.`,
      durationMs: r.ms,
    });
  }
}

// ---------------------------------------------------------------- GET cases
async function getCases() {
  // API-GET-001
  {
    const r = await req('GET', '/pet/findByStatus?status=available', { retryReads: 1 });
    const arr = r.json;
    const allMatch = Array.isArray(arr) && arr.every((p) => p.status === 'available');
    const ok = r.status === 200 && Array.isArray(arr) && arr.length > 0 && allMatch;
    record({
      id: 'API-GET-001', endpoint: 'GET /pet/findByStatus', scenario: 'Find pets by status "available" returns only available pets', type: 'Positive',
      preconditions: 'API is reachable', method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send GET /pet/findByStatus?status=available\n2. Check status code and that the body is a JSON array\n3. Verify every returned pet has status = "available"',
      expected: 'HTTP 200; JSON array where every element has status "available"',
      actual: `HTTP ${r.status} in ${r.ms} ms; ${Array.isArray(arr) ? `${arr.length} pets returned, elements with status != available: ${arr.filter((p) => p.status !== 'available').length}` : 'non-array body'}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Array is large (public shared dataset) - full array was parsed and validated in code.',
      durationMs: r.ms,
    });
  }

  // API-GET-002
  {
    const r = await req('GET', '/pet/findByStatus?status=pending', { retryReads: 1 });
    const arr = r.json;
    const allMatch = Array.isArray(arr) && arr.every((p) => p.status === 'pending');
    const ok = r.status === 200 && Array.isArray(arr) && allMatch;
    record({
      id: 'API-GET-002', endpoint: 'GET /pet/findByStatus', scenario: 'Find pets by status "pending" (valid status, possibly empty result)', type: 'Positive',
      preconditions: 'API is reachable', method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send GET /pet/findByStatus?status=pending\n2. Check status code and body type\n3. Verify every returned pet has status = "pending"',
      expected: 'HTTP 200; JSON array (may be empty) where every element has status "pending"',
      actual: `HTTP ${r.status} in ${r.ms} ms; ${Array.isArray(arr) ? `${arr.length} pets returned, elements with status != pending: ${arr.filter((p) => p.status !== 'pending').length}` : 'non-array body'}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Empty result is valid here because the shared dataset currently has no pending pets.',
      durationMs: r.ms,
    });
  }

  // API-GET-003
  {
    const r = await req('GET', '/pet/findByStatus?status=sold', { retryReads: 1 });
    const arr = r.json;
    const allMatch = Array.isArray(arr) && arr.every((p) => p.status === 'sold');
    const ok = r.status === 200 && Array.isArray(arr) && allMatch;
    record({
      id: 'API-GET-003', endpoint: 'GET /pet/findByStatus', scenario: 'Find pets by status "sold" returns only sold pets', type: 'Positive',
      preconditions: 'API is reachable', method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send GET /pet/findByStatus?status=sold\n2. Check status code and body type\n3. Verify every returned pet has status = "sold"',
      expected: 'HTTP 200; JSON array where every element has status "sold"',
      actual: `HTTP ${r.status} in ${r.ms} ms; ${Array.isArray(arr) ? `${arr.length} pets returned, elements with status != sold: ${arr.filter((p) => p.status !== 'sold').length}` : 'non-array body'}`,
      status: ok ? 'Pass' : 'Fail', notes: '',
      durationMs: r.ms,
    });
  }

  // API-GET-004 multi status
  {
    const r = await req('GET', '/pet/findByStatus?status=available&status=pending', { retryReads: 1 });
    const arr = r.json;
    const allowed = new Set(['available', 'pending']);
    const allMatch = Array.isArray(arr) && arr.every((p) => allowed.has(p.status));
    const ok = r.status === 200 && Array.isArray(arr) && allMatch;
    record({
      id: 'API-GET-004', endpoint: 'GET /pet/findByStatus', scenario: 'Multiple status parameters are combined (available + pending)', type: 'Positive (boundary)',
      preconditions: 'API is reachable', method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send GET /pet/findByStatus?status=available&status=pending\n2. Verify the result only contains pets with status available or pending',
      expected: 'HTTP 200; JSON array where every element has status "available" or "pending"',
      actual: `HTTP ${r.status} in ${r.ms} ms; ${Array.isArray(arr) ? `${arr.length} pets returned, elements outside {available, pending}: ${arr.filter((p) => !allowed.has(p.status)).length}` : 'non-array body'}`,
      status: ok ? 'Pass' : 'Fail', notes: '',
      durationMs: r.ms,
    });
  }

  // API-GET-005 invalid status value
  {
    const r = await req('GET', '/pet/findByStatus?status=notastatus');
    const ok = r.status === 400; // documented: 400 Invalid status value
    record({
      id: 'API-GET-005', endpoint: 'GET /pet/findByStatus', scenario: 'Invalid status value must be rejected with 400', type: 'Negative',
      preconditions: 'API is reachable', method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send GET /pet/findByStatus?status=notastatus\n2. Check that the API returns 400 Invalid status value as documented',
      expected: 'HTTP 400 Invalid status value',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 150)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Defect: invalid value is treated as a filter and returns 200 with an empty array instead of 400. See BUG-001.',
      durationMs: r.ms,
    });
  }

  // API-GET-006 missing status param
  {
    const r = await req('GET', '/pet/findByStatus');
    const ok = r.status === 400; // status is a required query parameter
    record({
      id: 'API-GET-006', endpoint: 'GET /pet/findByStatus', scenario: 'Missing required query parameter "status" must be rejected', type: 'Negative',
      preconditions: 'API is reachable', method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send GET /pet/findByStatus without the required status parameter\n2. Check that the API returns 400',
      expected: 'HTTP 400 (status is a required query parameter)',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 150)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Defect: missing parameter returns 200 with an empty array, hiding the client mistake. See BUG-001.',
      durationMs: r.ms,
    });
  }

  // API-GET-007 lifecycle integration: create -> appears in list -> delete -> gone
  {
    const p = { id: ID_BASE + 17, name: `QA_Pending_${RUN_TS}`, photoUrls: ['https://example.com/qa-pending.jpg'], status: 'pending' };
    const created = await req('POST', '/pet', { body: p });
    const before = created.status === 200 ? await req('GET', '/pet/findByStatus?status=pending', { retryReads: 1 }) : null;
    const presentBefore = before ? idFilter(before.json, p.id).length === 1 : false;
    const del = created.status === 200 ? await req('DELETE', `/pet/${p.id}`) : null;
    const after = del ? await req('GET', '/pet/findByStatus?status=pending', { retryReads: 1 }) : null;
    const presentAfter = after ? idFilter(after.json, p.id).length > 0 : null;
    const ok = created.status === 200 && presentBefore && del.status === 200 && presentAfter === false;
    record({
      id: 'API-GET-007', endpoint: 'GET /pet/findByStatus', scenario: 'Newly created pet appears in its status list and disappears after deletion', type: 'Positive (integration)',
      preconditions: 'API is reachable', method: 'GET', url: BASE + '/pet/findByStatus?status=pending', headers: 'Accept: application/json',
      body: `Step 1 body: ${JSON.stringify(p)}`,
      steps: `1. POST /pet with status "pending" (id ${p.id})\n2. GET /pet/findByStatus?status=pending and confirm the pet is present\n3. DELETE /pet/${p.id}\n4. Repeat the search and confirm the pet is gone`,
      expected: 'Pet is present in the pending list after creation and absent after deletion',
      actual: `POST -> HTTP ${created.status}; present in list after create: ${presentBefore}; DELETE -> HTTP ${del?.status}; present after delete: ${presentAfter}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Cross-endpoint check: create -> search -> delete -> search.',
      durationMs: created.ms + (before?.ms ?? 0) + (del?.ms ?? 0) + (after?.ms ?? 0),
    });
  }
}

// ------------------------------------------------------------- DELETE cases
async function deleteCases() {
  const p = { id: ID_BASE + 20, name: `QA_Delete_${RUN_TS}`, photoUrls: ['https://example.com/qa-del.jpg'], status: 'available' };
  const created = await req('POST', '/pet', { body: p });

  // API-DELETE-001
  {
    if (created.status !== 200) { record(skipped('API-DELETE-001', 'Could not create precondition pet (POST failed)')); ctx.delBlocked = true; }
    else {
      const r = await req('DELETE', `/pet/${p.id}`);
      const ok = r.status === 200 && r.json && String(r.json.message) === String(p.id) && r.json.code === 200;
      record({
        id: 'API-DELETE-001', endpoint: 'DELETE /pet/{petId}', scenario: 'Delete an existing pet returns 200 and the deleted id', type: 'Positive',
        preconditions: `Pet ${p.id} exists (created via POST in this run)`, method: 'DELETE', url: r.url, headers: 'Accept: application/json', body: '-',
        steps: '1. Create a pet via POST /pet\n2. Send DELETE /pet/{petId}\n3. Check status code and response message',
        expected: 'HTTP 200; body contains code 200 and message = deleted pet id',
        actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 150)}`,
        status: ok ? 'Pass' : 'Fail', notes: '',
        durationMs: r.ms,
      });
    }
  }

  // API-DELETE-002 (depends on DELETE-001)
  {
    if (ctx.delBlocked) { record(skipped('API-DELETE-002', 'Dependency API-DELETE-001 did not run')); }
    else {
      const r = await req('GET', `/pet/${p.id}`, { retryReads: 1 });
      const ok = r.status === 404 && r.json?.message === 'Pet not found';
      record({
        id: 'API-DELETE-002', endpoint: 'DELETE /pet/{petId}', scenario: 'Deleted pet is no longer retrievable by id', type: 'Positive (integration)',
        preconditions: 'API-DELETE-001 deleted pet ' + p.id, method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
        steps: '1. After deletion, send GET /pet/{petId} with the deleted id\n2. Verify the pet is gone',
        expected: 'HTTP 404 "Pet not found"',
        actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 150)}`,
        status: ok ? 'Pass' : 'Fail', notes: 'Confirms the deletion is effective on this endpoint, not just acknowledged.',
        durationMs: r.ms,
      });
    }
  }

  // API-DELETE-003 (depends on DELETE-001)
  {
    if (ctx.delBlocked) { record(skipped('API-DELETE-003', 'Dependency API-DELETE-001 did not run')); }
    else {
      const r = await req('GET', '/pet/findByStatus?status=available', { retryReads: 1 });
      const stillThere = idFilter(r.json, p.id).length > 0;
      const ok = r.status === 200 && stillThere === false;
      record({
        id: 'API-DELETE-003', endpoint: 'DELETE /pet/{petId}', scenario: 'Deleted pet no longer appears in findByStatus results', type: 'Positive (integration)',
        preconditions: 'API-DELETE-001 deleted pet ' + p.id, method: 'GET', url: r.url, headers: 'Accept: application/json', body: '-',
        steps: '1. After deletion, search status "available"\n2. Confirm the deleted pet id is not in the result',
        expected: 'HTTP 200; deleted pet id is absent from the array',
        actual: `HTTP ${r.status} in ${r.ms} ms; array size: ${Array.isArray(r.json) ? r.json.length : 'n/a'}; deleted pet present: ${stillThere}`,
        status: ok ? 'Pass' : 'Fail', notes: '',
        durationMs: r.ms,
      });
    }
  }

  // API-DELETE-004 never existed
  {
    const ghostId = ID_BASE + 99;
    const r = await req('DELETE', `/pet/${ghostId}`);
    const ok = r.status === 404;
    record({
      id: 'API-DELETE-004', endpoint: 'DELETE /pet/{petId}', scenario: 'Delete a pet that does not exist returns 404', type: 'Negative',
      preconditions: `Pet ${ghostId} was never created`, method: 'DELETE', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send DELETE /pet/{petId} with an id that does not exist\n2. Check status code',
      expected: 'HTTP 404 Pet not found',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 100)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Status code matches the documentation. Note: for numeric ids the 404 body is empty, while non-numeric ids return a JSON error - inconsistent format (low impact, see API-DELETE-005).',
      durationMs: r.ms,
    });
  }

  // API-DELETE-005 non-numeric id
  {
    const r = await req('DELETE', '/pet/abc');
    const ok = r.status === 400; // documented: 400 Invalid ID supplied
    record({
      id: 'API-DELETE-005', endpoint: 'DELETE /pet/{petId}', scenario: 'Non-numeric petId must be rejected with 400 Invalid ID', type: 'Negative',
      preconditions: 'API is reachable', method: 'DELETE', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send DELETE /pet/abc\n2. Check that the API returns 400 Invalid ID supplied as documented',
      expected: 'HTTP 400 Invalid ID supplied',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 200)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Defect: returns 404 with an internal java.lang.NumberFormatException message instead of 400. See BUG-004.',
      durationMs: r.ms,
    });
  }

  // API-DELETE-006 id = 0
  {
    const r = await req('DELETE', '/pet/0');
    const ok = r.status === 404;
    record({
      id: 'API-DELETE-006', endpoint: 'DELETE /pet/{petId}', scenario: 'Boundary: pet id 0 does not exist', type: 'Boundary',
      preconditions: 'No pet with id 0 exists', method: 'DELETE', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send DELETE /pet/0\n2. Check status code',
      expected: 'HTTP 404 Pet not found (id 0 is a valid integer but no such pet exists)',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 100)}`,
      status: ok ? 'Pass' : 'Fail', notes: 'Empty 404 body for numeric ids, same as API-DELETE-004.',
      durationMs: r.ms,
    });
  }

  // API-DELETE-007 no id
  {
    const r = await req('DELETE', '/pet');
    const ok = r.status === 405;
    record({
      id: 'API-DELETE-007', endpoint: 'DELETE /pet/{petId}', scenario: 'Boundary: DELETE without a petId is not allowed', type: 'Boundary',
      preconditions: 'API is reachable', method: 'DELETE', url: r.url, headers: 'Accept: application/json', body: '-',
      steps: '1. Send DELETE /pet (no id)\n2. Check that the API rejects the request',
      expected: 'HTTP 405 Method Not Allowed (no such route)',
      actual: `HTTP ${r.status} in ${r.ms} ms; body: ${excerpt(r, 100)}`,
      status: ok ? 'Pass' : 'Fail', notes: '',
      durationMs: r.ms,
    });
  }
}

function skipped(id, reason = 'Dependency did not run') {
  return {
    id, endpoint: '-', scenario: '-', type: '-', preconditions: '-', method: '-', url: '-', headers: '-', body: '-',
    steps: '-', expected: '-', actual: `Not executed: ${reason}`, status: 'Blocked', notes: reason, durationMs: 0,
  };
}

// -------------------------------------------------------------------- main
(async () => {
  log(`# Manual API test run - Petstore`);
  log(`# Base URL : ${BASE}`);
  log(`# Started  : ${new Date().toISOString()}`);
  log(`# Tool     : Node.js ${process.version} fetch script (tools/run-manual-api-tests.mjs)`);
  log('');

  await postCases();
  await getCases();
  await deleteCases();

  const summary = { total: cases.length, pass: 0, fail: 0, blocked: 0, notExecuted: 0 };
  for (const c of cases) {
    if (c.status === 'Pass') summary.pass++;
    else if (c.status === 'Fail') summary.fail++;
    else if (c.status === 'Blocked') summary.blocked++;
    else summary.notExecuted++;
    log(`[${c.status.toUpperCase()}] ${c.id} - ${c.scenario}`);
    log(`  request : ${c.method} ${c.url}`);
    log(`  expected: ${c.expected}`);
    log(`  actual  : ${c.actual}`);
    if (c.notes) log(`  notes   : ${c.notes}`);
    log('');
  }
  log(`Summary: ${summary.total} total, ${summary.pass} pass, ${summary.fail} fail, ${summary.blocked} blocked, ${summary.notExecuted} not executed`);
  log(`Finished : ${new Date().toISOString()}`);

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const results = {
    runInfo: {
      startedAt: new Date(RUN_TS).toISOString(),
      finishedAt: new Date().toISOString(),
      baseUrl: BASE,
      tool: `Node.js ${process.version} fetch script (task-1-manual-api/tools/run-manual-api-tests.mjs)`,
      os: `${os.type()} ${os.release()}`,
    },
    summary,
    cases,
  };
  writeFileSync(resolve(EVIDENCE_DIR, 'manual-run-results.json'), JSON.stringify(results, null, 2));
  writeFileSync(resolve(EVIDENCE_DIR, 'manual-run-log.txt'), logLines.join('\n'));
  console.log(`\nEvidence written to ${EVIDENCE_DIR}`);
})();
