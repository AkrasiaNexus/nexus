import test from "node:test";
import assert from "node:assert/strict";
import { webSearch, SearchUnavailable } from "../src/lib/search.js";

function stub(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}
// Exactly the shape the live API returned.
const ok = (web) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { web } }) });

test("results come back as the plain list the rest of the code expects", async () => {
  const restore = stub(async () => ok([{ url: "https://e/1", title: "One", description: "d", position: 1 }]));

  const out = await webSearch("rust internship", { key: "k" });

  assert.equal(out.length, 1);
  assert.equal(out[0].url, "https://e/1");
  restore();
});

test("the query and the key go where the API expects them", async () => {
  let sent, headers;
  const restore = stub(async (_url, init) => { sent = JSON.parse(init.body); headers = init.headers; return ok([]); });

  await webSearch("hackathon deadline", { key: "secret", limit: 3 });

  assert.equal(sent.query, "hackathon deadline");
  assert.equal(sent.limit, 3);
  assert.deepEqual(sent.sources, ["web"]);
  assert.equal(headers.Authorization, "Bearer secret");
  restore();
});

test("with no key she doesn't go looking, and says why", async () => {
  await assert.rejects(webSearch("anything", { key: null }), (e) => e instanceof SearchUnavailable && /no search key/.test(e.message));
});

test("a refused key is reported as that, not as an empty night", async () => {
  const restore = stub(async () => ({ ok: false, status: 401 }));

  await assert.rejects(webSearch("x", { key: "bad" }), (e) => e instanceof SearchUnavailable && /refused/.test(e.message));
  restore();
});

test("the service being down is not mistaken for finding nothing", async () => {
  const restore = stub(async () => { throw new TypeError("fetch failed"); });

  await assert.rejects(webSearch("x", { key: "k" }), (e) => e instanceof SearchUnavailable && /couldn't reach/.test(e.message));
  restore();
});

test("an empty result set is an empty night, not an error", async () => {
  const restore = stub(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) }));

  assert.deepEqual(await webSearch("x", { key: "k" }), []);
  restore();
});

test("a key set on this machine is used, and never lives in the plan", async () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  store["donna_search_key"] = "local-key";
  let headers;
  const restore = stub(async (_u, init) => { headers = init.headers; return ok([]); });

  const { apiKey } = await import("../src/lib/search.js?fresh=1");
  await webSearch("x", { key: apiKey() });

  assert.equal(headers.Authorization, "Bearer local-key");
  assert.equal(store["donna_plan"], undefined, "the key is its own entry, not part of the plan the model is shown");
  restore();
  delete globalThis.localStorage;
});
