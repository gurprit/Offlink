import {MeshNode} from '../models/MeshNode';
import {extractTopologyPayload} from './MeshPayloadBundleService';

let localSequence = 0;

export interface MeshTopologySummaryNode {
  id: string;
  userId?: string;
  hops: number;
  quality: number;
}

export interface MeshTopologySummary {
  version: 2;
  nodeId: string;
  sequence: number;
  timestamp: number;
  ttl: number;
  neighbours: MeshTopologySummaryNode[];
}

export function createMeshTopologySummary(
  nodeId: string,
  nodes: MeshNode[],
): MeshTopologySummary {
  localSequence++;

  return {
    version: 2,
    nodeId,
    sequence: localSequence,
    timestamp: Date.now(),
    ttl: 4,
    neighbours: nodes
      .filter(node => node.id !== nodeId)
      .slice(0, 12)
      .map(node => ({
        id: node.id,
        userId: node.userId,
        hops: node.hops,
        quality: node.quality,
      })),
  };
}

export function encodeMeshTopologySummary(summary: MeshTopologySummary): string {
  return `OLMESH|${JSON.stringify(summary)}`;
}

export function decodeMeshTopologySummary(
  value: string | null | undefined,
): MeshTopologySummary | null {
  const topologyPayload = extractTopologyPayload(value);

  if (!topologyPayload?.startsWith('OLMESH|')) {
    return null;
  }

  try {
    const parsed = JSON.parse(topologyPayload.slice('OLMESH|'.length));

    if (
      typeof parsed?.version !== 'number' ||
      typeof parsed.nodeId !== 'string' ||
      typeof parsed.sequence !== 'number' ||
      typeof parsed.timestamp !== 'number' ||
      typeof parsed.ttl !== 'number' ||
      !Array.isArray(parsed.neighbours)
    ) {
      return null;
    }

    return {
      version: 2,
      nodeId: parsed.nodeId,
      sequence: parsed.sequence,
      timestamp: parsed.timestamp,
      ttl: parsed.ttl,
      neighbours: parsed.neighbours
        .filter((node: unknown) => {
          const item = node as Partial<MeshTopologySummaryNode>;

          return (
            typeof item.id === 'string' &&
            typeof item.hops === 'number' &&
            typeof item.quality === 'number'
          );
        })
        .slice(0, 12)
        .map((node: MeshTopologySummaryNode) => ({
          id: node.id,
          userId: typeof node.userId === 'string' ? node.userId : undefined,
          hops: Math.max(1, Math.min(8, Math.round(node.hops))),
          quality: Math.max(0, Math.min(100, Math.round(node.quality))),
        })),
    };
  } catch {
    return null;
  }
}
