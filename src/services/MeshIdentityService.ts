const MESH_ID_PREFIX = 'M';

export function createMeshId(): string {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();

  return `${MESH_ID_PREFIX}${timePart}${randomPart}`;
}

export function ensureMeshId(value?: string | null): string {
  const cleaned = typeof value === 'string' ? value.trim().toUpperCase() : '';

  if (
    cleaned.startsWith(MESH_ID_PREFIX) &&
    cleaned.length >= 8 &&
    cleaned.length <= 12 &&
    /^[A-Z0-9]+$/.test(cleaned)
  ) {
    return cleaned;
  }

  return createMeshId();
}
