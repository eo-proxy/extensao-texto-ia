export function mockChrome(initial = {}, initialSession = {}) {
  const state = structuredClone(initial), sessionState = structuredClone(initialSession);
  const permissions = new Set(), messages = [], listeners = {};
  const event = (name) => ({ addListener: (callback) => { listeners[name] = callback; } });
  const area = (values, name) => ({
    setAccessLevel: async ({ accessLevel }) => { chrome.accessLevels[name] = accessLevel; if (name === "local") chrome.accessLevel = accessLevel; },
    get: async (keys) => keys == null ? structuredClone(values) : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => key in values).map((key) => [key, structuredClone(values[key])])),
    set: async (updates) => Object.assign(values, structuredClone(updates)),
    remove: async (keys) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
    clear: async () => { for (const key of Object.keys(values)) delete values[key]; }
  });
  const chrome = {
    accessLevels: {},
    runtime: { id: "test-extension", getURL: (path) => "chrome-extension://test-extension/" + path, onMessage: event("message") },
    permissions: {
      contains: async ({ origins }) => origins.every((origin) => permissions.has(origin)),
      request: async ({ origins }) => { origins.forEach((origin) => permissions.add(origin)); return true; },
      onAdded: event("permissionAdded"), onRemoved: event("permissionRemoved")
    },
    tabs: { onRemoved: event("tabRemoved"), onUpdated: event("tabUpdated"), query: async () => [], sendMessage: async (_tab, message) => { messages.push(message); } },
    storage: { onChanged: event("storageChanged"), local: area(state, "local"), session: area(sessionState, "session") }
  };
  return { chrome, state, sessionState, permissions, messages, listeners };
}

