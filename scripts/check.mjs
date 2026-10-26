import assert from "node:assert/strict";
import { readdir, readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PROVIDERS } from "../brave-text-assistant/providers.mjs";

const folder = new URL("../brave-text-assistant/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", folder), "utf8"));
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual([...manifest.optional_host_permissions].sort(), Object.values(PROVIDERS).map((info) => info.host).sort());
for (const path of [
  manifest.background.service_worker, manifest.action.default_popup,
  ...manifest.content_scripts.flatMap((script) => script.js),
  ...Object.values(manifest.icons), ...manifest.web_accessible_resources.flatMap((resource) => resource.resources)
]) await access(new URL(path, folder));

const html = await readFile(new URL("sidepanel.html", folder), "utf8");
assert.match(html, /script type="module" src="sidepanel\.js"/);
assert.ok(html.includes("v" + manifest.version));
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "IDs HTML devem ser únicos");
const script = await readFile(new URL("sidepanel.js", folder), "utf8");
for (const match of script.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(match[1]), "ID ausente no HTML: " + match[1]);

for (const name of await readdir(folder)) {
  if (!/\.(js|mjs)$/.test(name)) continue;
  const result = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(name, folder))], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}
console.log("Manifesto, arquivos, formulário e sintaxe conferidos — v" + manifest.version + ".");


