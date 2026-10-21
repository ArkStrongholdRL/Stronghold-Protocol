// Client-declared control source; metadata only, never authorization or an engine AI seat.
// Missing legacy declarations stay unknown. Only the server creates a bot controller.
const CLIENTS = ['web', 'dsh-plugin', 'codex-mcp'];
export function isControllerDeclaration(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && ['human', 'llm'].includes(value.kind)
    && (value.client == null || CLIENTS.includes(value.client))
    && Object.keys(value).every(key => key === 'kind' || key === 'client');
}
export function normalizeController(value, isBot = false) {
  if (isBot) return { kind: 'bot', client: null };
  if (!isControllerDeclaration(value)) return { kind: 'unknown', client: null };
  return { kind: value.kind, client: value.client ?? null };
}
export function sameController(a, b) {
  return a?.kind === b?.kind && a?.client === b?.client;
}
