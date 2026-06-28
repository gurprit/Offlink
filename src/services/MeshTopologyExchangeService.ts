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
const TOPOLOGY_PUBLISH_THROTTLE_MS = 5000;

export async function publishLocalTopology(selfId: string): Promise<string> {
  const now = Date.now();

  if (
    lastPublishedPayload &&
    now - lastPublishAt < TOPOLOGY_PUBLISH_THROTTLE_MS
  ) {
    return lastPublishedPayload;
  }

  if (publishPromise) {
    return publishPromise;
  }

  publishPromise = (async () => {
    const summary = createMeshTopologySummary(selfId, MeshTopology.getTopology());
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


export function applyTopologyPayload(payload: string): boolean {
  const summary = decodeMeshTopologySummary(payload);

  if (!summary) {
    return false;
  }

  console.log('OFFLINK_TOPOLOGY_APPLY', JSON.stringify(summary));

  for (const neighbour of summary.neighbours) {
    if (neighbour.id === summary.nodeId) {
      continue;
    }

    MeshTopology.updateRemoteNode(
      neighbour.id,
      'remote',
      neighbour.quality,
      neighbour.hops + 1,
      summary.nodeId,
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
