import test from "node:test";
import assert from "node:assert/strict";
import { buildInspirationDraft, localInspirationEndpoint } from "../src/board-drop-model.mjs";
import { dropToInspiration } from "../electron/board-capture.mjs";

test("inspiration endpoint only allows loopback and appends /drop", () => {
  assert.equal(localInspirationEndpoint("http://127.0.0.1:8788"), "http://127.0.0.1:8788/drop");
  assert.equal(localInspirationEndpoint("http://localhost:8788/"), "http://localhost:8788/drop");
  assert.equal(localInspirationEndpoint("http://[::1]:8788/drop"), "http://[::1]:8788/drop");
  assert.throws(() => localInspirationEndpoint("https://example.com"), /只许发到本机/);
  assert.throws(() => localInspirationEndpoint(""), /还没配/);
});

test("notes, links and one image become Cabinet drop payloads", () => {
  assert.deepEqual(buildInspirationDraft({ mode: "note", text: "合成想法" }).payload, { kind: "note", value: "合成想法" });
  assert.deepEqual(buildInspirationDraft({ mode: "link", text: "https://example.com/a" }).payload, { kind: "url", value: "https://example.com/a" });
  const image = buildInspirationDraft({ mode: "image", image: { name: "synthetic.png", type: "image/png", data: "YWJj" } });
  assert.equal(image.ok, true);
  assert.equal(image.payload.kind, "image");
  assert.equal(buildInspirationDraft({ mode: "image", image: { name: "x.txt", type: "text/plain", data: "YWJj" } }).ok, false);
});

test("created and duplicate responses are distinct visible successes", async () => {
  for (const [httpStatus, status, message] of [[200, "created", "已放进灵感池。"], [409, "duplicate", "这条已经在灵感池里了。"]]) {
    const result = await dropToInspiration({ mode: "note", text: "合成想法" }, {
      env: { INSPIRATION_POOL_URL: "http://127.0.0.1:8788" },
      fetchFn: async (_url, options) => {
        assert.equal(options.redirect, "manual");
        return { status: httpStatus, json: async () => ({ status, id: "synthetic-1" }) };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, status);
    assert.equal(result.message, message);
  }
});

test("an offline pool keeps a clear retry state", async () => {
  const result = await dropToInspiration({ mode: "note", text: "合成想法" }, {
    env: { INSPIRATION_POOL_URL: "http://127.0.0.1:8788" },
    fetchFn: async () => { throw new Error("offline"); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "offline");
  assert.match(result.error, /内容还在/);
});
