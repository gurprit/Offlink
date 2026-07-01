import MeshTopology from './MeshTopology';
import {
  createMeshTopologySummary,
  decodeMeshTopologySummary,
  encodeMeshTopologySummary,
} from './MeshTopologyProtocol';
import {
  readGattPayloadFromNearest,
  setGattPayload,
} from './GattService';

let lastPublishAt = 0;
let lastPublishedPayload = '';
let publishPromise: Promise<string> | null = null;
let localMeshId: string | null = null;
const TOPOLOGY_PUBLISH_THROTTLE_MS = 5000;
const lastSequenceByNode: Record<string, number> = {};

export function setLocalMeshId(meshId: string | null): void {
  localMeshId = meshId;
  MeshTopology.setSelfMeshId(meshId);
}

export async function publishLocalTopology(selfMeshId: string, force = false): Promise<string> {
  const now = Date.now();
  setLocalMeshId(selfMeshId);

  if (
    !force &&
    lastPublishedPayload &&
    now - lastPublishAt < TOPOLOGY_PUBLISH_THROTTLE_MS
  ) {
    return lastPublishedPayload;
  }

  if (publishPromise) {
    return publishPromise;
  }

  publishPromise = (async () => {
    const summary = createMeshTopologySummary(selfMeshId, MeshTopology.getTopology());
    const encoded = encodeMeshTopologySummary(summary);

    await setGattPayload(encoded);

    lastPublishAt = Date.now();
    lastPublishedPayload = encoded;

    console.log('OFFLINK_TOPOLOGY_PUBLISHED', encoded);

    return encoded;
  })();

  try {
    return await publishPromise;
  } finally {
    publishPromise = null;
  }
}

export function applyTopologyPayload(
  payload: string,
  ownMeshId: string | null = localMeshId,
  ownUserId: string | null = null,
  viaOverride: string | null = null,
): boolean {
  const summary = decodeMeshTopologySummary(payload);

  if (!summary) {
    return false;
  }

  if (ownMeshId) {
    setLocalMeshId(ownMeshId);
  }

  if (
    (ownMeshId && summary.nodeId === ownMeshId) ||
    (ownUserId && summary.nodeId === ownUserId)
  ) {
    console.log('OFFLINK_TOPOLOGY_SELF_REFLECTION_DROPPED', summary.nodeId);
    return true;
  }

  const lastSequence = lastSequenceByNode[summary.nodeId] ?? 0;

  if (summary.sequence <= lastSequence) {
    console.log(
      'OFFLINK_TOPOLOGY_STALE',
      JSON.stringify({
        nodeId: summary.nodeId,
        sequence: summary.sequence,
        lastSequence,
      }),
    );

    return true;
  }

  lastSequenceByNode[summary.nodeId] = summary.sequence;

  console.log('OFFLINK_TOPOLOGY_APPLY', JSON.stringify(summary));

  for (const neighbour of summary.neighbours) {
    const via = viaOverride || summary.nodeId;

    console.log(
      'OFFLINK_TOPOLOGY_NEIGHBOUR_SEEN',
      JSON.stringify({
        neighbour,
        via,
        ownMeshId,
        ownUserId,
        summaryNodeId: summary.nodeId,
      }),
    );

    if (neighbour.id === summary.nodeId) {
      console.log('OFFLINK_TOPOLOGY_NEIGHBOUR_SKIPPED_SAME_AS_SENDER', neighbour.id);
      continue;
    }

    if (
      (ownMeshId && neighbour.id === ownMeshId) ||
      (ownUserId && neighbour.id === ownUserId) ||
      (ownUserId && neighbour.userId === ownUserId)
    ) {
      console.log('OFFLINK_TOPOLOGY_NEIGHBOUR_SKIPPED_SELF', JSON.stringify(neighbour));
      continue;
    }

    MeshTopology.updateRemoteNode(
      neighbour.id,
      'remote',
      neighbour.quality,
      neighbour.hops + 1,
      via,
      neighbour.userId,
    );

    console.log(
      'OFFLINK_TOPOLOGY_AFTER_REMOTE_UPDATE',
      JSON.stringify(MeshTopology.getTopology()),
    );
  }

  return true;
}

export async function readAndApplyNearbyTopology(): Promise<string> {
  const payload = await readGattPayloadFromNearest();
  if (!applyTopologyPayload(payload)) {
    console.log('OFFLINK_TOPOLOGY_READ_IGNORED', payload);
  }

  return payload;
}
