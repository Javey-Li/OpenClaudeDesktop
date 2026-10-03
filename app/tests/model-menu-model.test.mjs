import test from "node:test";
import assert from "node:assert/strict";
import { effortName, modelMenuSections } from "../src/model-menu-model.mjs";

const model = (id, extra = {}) => ({ id, model: id, displayName: id, ...extra });
const ids = (list) => list.map((entry) => entry.model);

test("the Fast section exists only for a model with a Fast tier (shared-14 ES)", () => {
  const models = [model("deepseek-flash"), model("deepseek-v4-pro")];
  assert.equal(modelMenuSections({ models, fastTier: null }).showFast, false);
  assert.equal(modelMenuSections({ models }).showFast, false);
  assert.equal(modelMenuSections({ models, fastTier: { id: "priority", name: "Fast" } }).showFast, true);
});

test("the primary/overflow split keeps the first four; explicit catalog sections win", () => {
  const two = modelMenuSections({ models: [model("deepseek-flash"), model("deepseek-v4-pro")] });
  assert.deepEqual([ids(two.primary), ids(two.overflow)], [["deepseek-flash", "deepseek-v4-pro"], []]);
  const six = modelMenuSections({ models: ["a", "b", "c", "d", "e", "f"].map((id) => model(id)) });
  assert.deepEqual([ids(six.primary), ids(six.overflow)], [["a", "b", "c", "d"], ["e", "f"]]);
  const sectioned = modelMenuSections({ models: [model("a", { section: "overflow" }), model("b", { section: "main" }), model("c")] });
  assert.deepEqual([ids(sectioned.primary), ids(sectioned.overflow)], [["b", "c"], ["a"]]);
  const keyless = modelMenuSections({ models: [{ displayName: "no id" }, model("x")] });
  assert.deepEqual(ids(keyless.primary), ["x"], "a row without a model id is not offered");
  assert.deepEqual(modelMenuSections({ models: null }), { primary: [], overflow: [], showFast: false });
});

test("effort names are the capitalized ids", () => {
  assert.deepEqual(["off", "low", "high", "max", "xhigh", ""].map(effortName), ["Off", "Low", "High", "Max", "Xhigh", ""]);
});
