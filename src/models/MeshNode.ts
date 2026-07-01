export interface MeshNode {
  /** Permanent mesh routing identity */
  id: string;

  /** Offlink friend/user identity advertised by this node */
  userId?: string;

  /** Friendly display name or emoji */
  name: string;

  /** Latest RSSI */
  rssi: number;

  /** Signal quality from 0-100 */
  quality: number;

  /** First time we saw this node */
  firstSeen: number;

  /** Last time we saw this node */
  lastSeen: number;

  /** Last time this node record changed */
  lastUpdated: number;

  /** Number of hops from us */
  hops: number;

  /** Which mesh node introduced this node */
  via: string | null;

  /** Human-readable discovery source */
  discoveredVia: string;

  /** Whether the device is directly reachable */
  connected: boolean;

  /** Route score from 0-100 */
  routeScore?: number;

  /** Why this route was chosen */
  routeReason?: string;
}
