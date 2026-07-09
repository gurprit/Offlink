export const OFFLINK_BUNDLE_PREFIX = 'OLBUNDLE|';

export type MeshPayloadBundle = {
  version: 1;
  topology?: string | null;
  mesh?: string | null;
};

export function encodeMeshPayloadBundle(bundle: MeshPayloadBundle): string {
  return `${OFFLINK_BUNDLE_PREFIX}${JSON.stringify(bundle)}`;
}

export function decodeMeshPayloadBundle(
  value: string | null | undefined,
): MeshPayloadBundle | null {
  if (!value?.startsWith(OFFLINK_BUNDLE_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value.slice(OFFLINK_BUNDLE_PREFIX.length));

    if (!parsed || parsed.version !== 1) {
      return null;
    }

    return {
      version: 1,
      topology:
        typeof parsed.topology === 'string' ? parsed.topology : null,
      mesh:
        typeof parsed.mesh === 'string' ? parsed.mesh : null,
    };
  } catch {
    return null;
  }
}

export function extractTopologyPayload(
  value: string | null | undefined,
): string | null {
  const bundle = decodeMeshPayloadBundle(value);

  if (bundle?.topology) {
    return bundle.topology;
  }

  if (value?.startsWith('OLMESH|')) {
    return value;
  }

  return null;
}

export function extractMeshPayload(
  value: string | null | undefined,
): string | null {
  const bundle = decodeMeshPayloadBundle(value);

  if (bundle?.mesh) {
    return bundle.mesh;
  }

  if (value?.trim().startsWith('{')) {
    return value;
  }

  return null;
}
