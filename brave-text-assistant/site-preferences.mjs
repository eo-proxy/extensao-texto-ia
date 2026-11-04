export const SITE_KEY_PREFIX = "sitePreference:";
let writes = Promise.resolve();
export function siteOrigin(value) {
  try {
    if (typeof value !== "string") throw new Error();
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
    return url.origin;
  } catch (_) { throw new Error("Este endereço não permite revisão de texto."); }
}
export async function getSitePreference(value) {
  const origin = siteOrigin(value), key = SITE_KEY_PREFIX + origin;
  const data = await chrome.storage.local.get(key), record = data[key];
  const decided = typeof record?.enabled === "boolean" && typeof record?.revision === "string";
  return { siteOrigin: origin, siteLabel: new URL(origin).host, siteDecided: decided, siteEnabled: decided && record.enabled === true, siteRevision: decided ? record.revision : "" };
}
export function saveSitePreference(value, enabled) {
  const origin = siteOrigin(value);
  if (typeof enabled !== "boolean") throw new Error("Escolha ativar ou desativar este site.");
  const pending = writes.then(async () => {
    const current = await getSitePreference(origin);
    if (current.siteDecided && current.siteEnabled === enabled) return current;
    await chrome.storage.local.set({ [SITE_KEY_PREFIX + origin]: { enabled, revision: crypto.randomUUID() } });
    return getSitePreference(origin);
  });
  writes = pending.catch(() => {});
  return pending;
}
