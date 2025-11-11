export const normalizePathInput = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '').trim();

export const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
