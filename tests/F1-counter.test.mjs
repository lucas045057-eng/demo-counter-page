// F1：页面能点一下加一。把 index.html 的内联脚本放进 node:vm 里真跑，模拟点击按钮。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const html = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");

function loadPage() {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, "页面里应有内联脚本");
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const elements = new Map();
  const getElementById = (id) => {
    if (!htmlIds.has(id)) return null;
    if (!elements.has(id)) elements.set(id, { id, textContent: "", href: "", onclick: null });
    return elements.get(id);
  };
  const sandbox = {
    window: {},
    document: { getElementById },
    fetch: () => Promise.reject(new Error("测试里不联网")),
    Error,
    String,
  };
  vm.runInNewContext(script, sandbox, { timeout: 5000 });
  return { getElementById, ready: sandbox.window.__ready };
}

test("F1：页面有计数显示和按钮，初始为 0", async () => {
  const { getElementById, ready } = loadPage();
  await ready;
  assert.match(html, /<strong id="count">0<\/strong>/);
  assert.equal(typeof getElementById("increment").onclick, "function");
});

test("F1：点一下加一，连点三下显示 3", async () => {
  const { getElementById, ready } = loadPage();
  await ready;
  const button = getElementById("increment");
  const count = getElementById("count");
  button.onclick();
  assert.equal(count.textContent, "1");
  button.onclick();
  button.onclick();
  assert.equal(count.textContent, "3");
});
