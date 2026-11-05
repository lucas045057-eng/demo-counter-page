// F2：刷新后计数还在。把 index.html 的内联脚本放进 node:vm 里真跑，用同一个假 localStorage 模拟"刷新"（重新执行脚本）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const html = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    data,
  };
}

function loadPage(localStorage) {
  assert.ok(script, "页面里应有内联脚本");
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
  };
  if (localStorage !== undefined) sandbox.localStorage = localStorage;
  vm.runInNewContext(script, sandbox, { timeout: 5000 });
  return { getElementById, ready: sandbox.window.__ready };
}

test("F2：点了几下之后刷新，计数还在，并能接着加", async () => {
  const storage = makeStorage();
  const first = loadPage(storage);
  await first.ready;
  first.getElementById("increment").onclick();
  first.getElementById("increment").onclick();
  first.getElementById("increment").onclick();
  assert.equal(first.getElementById("count").textContent, "3");

  const reloaded = loadPage(storage);
  await reloaded.ready;
  assert.equal(reloaded.getElementById("count").textContent, "3");
  reloaded.getElementById("increment").onclick();
  assert.equal(reloaded.getElementById("count").textContent, "4");

  const again = loadPage(storage);
  await again.ready;
  assert.equal(again.getElementById("count").textContent, "4");
});

test("F2：第一次打开（没存过）显示 0", async () => {
  const page = loadPage(makeStorage());
  await page.ready;
  assert.equal(page.getElementById("count").textContent, "0");
});

test("F2：存的值坏了就从 0 开始，不显示乱码", async () => {
  for (const bad of ["abc", "-5", "", "99999999999999999999"]) {
    const page = loadPage(makeStorage({ "counter.count": bad }));
    await page.ready;
    assert.equal(page.getElementById("count").textContent, "0", `存的是 ${JSON.stringify(bad)}`);
  }
});

test("F2：存储不可用时照常计数，不报错", async () => {
  const throwing = {
    getItem() { throw new Error("禁用"); },
    setItem() { throw new Error("禁用"); },
  };
  for (const storage of [undefined, throwing]) {
    const page = loadPage(storage);
    await page.ready;
    assert.equal(page.getElementById("count").textContent, "0");
    page.getElementById("increment").onclick();
    assert.equal(page.getElementById("count").textContent, "1");
  }
});
