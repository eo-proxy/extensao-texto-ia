import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PROVIDERS } from "../brave-text-assistant/providers.mjs";
const manifest = JSON.parse(await readFile(new URL("../brave-text-assistant/manifest.json", import.meta.url), "utf8"));
const hosts = ["https://api.openai.com", "https://generativelanguage.googleapis.com", "https://api.anthropic.com"];

test("Política de scripts impede execução remota e conexões ficam nos três provedores", () => {
  const directives = Object.fromEntries(manifest.content_security_policy.extension_pages.split(";").map(part => part.trim().split(/\s+/)).filter(parts => parts[0]).map(([name, ...values]) => [name, values]));
  assert.deepEqual(directives["script-src"], ["'self'"]);
  assert.deepEqual(directives["object-src"], ["'none'"]);
  assert.deepEqual([...directives["connect-src"]].sort(), [...hosts].sort());
  for (const provider of Object.values(PROVIDERS)) assert.ok(hosts.includes(new URL(provider.baseUrl).origin));
});

test("Manifesto mantém scripts isolados e não expõe páginas ou código a sites", () => {
  assert.equal(manifest.externally_connectable, undefined);
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting", "storage"]);
  for (const script of manifest.content_scripts) { assert.ok(!script.world || script.world === "ISOLATED"); assert.ok(!script.all_frames); }
  for (const entry of manifest.web_accessible_resources) for (const resource of entry.resources) assert.match(resource, /^assets\/.+\.(png|svg)$/);
});
