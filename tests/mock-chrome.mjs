export function mockChrome(initial = {}) {
  const state = structuredClone(initial);
  const permissions = new Set();
  const messages = [];
  const listeners = {};
  const event = (name) => ({ addListener: (callback) => { listeners[name] = callback; } });
  const chrome = {
    runtime: { id: "test-extension", getURL: (path) => "chrome-extension://test-extension/" + path, onMessage: event("message") },
    permissions: {
      contains: async ({ origins }) => origins.every((origin) => permissions.has(origin)),
      onAdded: event("permissionAdded"), onRemoved: event("permissionRemoved")
    },
    tabs: { query: async () => [], sendMessage: async (_tab, message) => { messages.push(message); } },
    storage: {
      onChanged: event("storageChanged"),
      local: {
        setAccessLevel: async (value) => { chrome.accessLevel = value.accessLevel; },
        get: async (keys) => {
          if (keys == null) return structuredClone(state);
          return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => key in state).map((key) => [key, structuredClone(state[key])]));
        },
        set: async (updates) => { Object.assign(state, structuredClone(updates)); },
        remove: async (keys) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; }
      }
    }
  };
  return { chrome, state, permissions, messages, listeners };
}

