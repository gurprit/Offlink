import React, {useEffect, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {
  MeshDiagnosticsSnapshot,
  NearbyOfflinkUser,
} from '../models/types';
import {MeshNode} from '../models/MeshNode';
import MeshTopology from '../services/MeshTopology';
import {loadProfile} from '../services/StorageService';
import {createMeshTopologySummary, encodeMeshTopologySummary} from '../services/MeshTopologyProtocol';
import {publishLocalTopology, readAndApplyNearbyTopology} from '../services/MeshTopologyExchangeService';
import {getAllNeighbourReliability, MeshNeighbourReliabilityStats} from '../services/MeshNeighbourReliability';
import {
  getAllRouteMemory,
  MeshRouteMemoryStats,
} from '../services/MeshRouteMemory';
import {
  getMeshDiagnosticsSnapshot,
  resetMeshDiagnostics,
} from '../services/MeshDiagnosticsService';
import {
  clearMeshFlightRecorder,
  createMeshFlightRecorderExport,
  getMeshFlightRecorderEvents,
  MeshFlightRecorderEvent,
  subscribeToMeshFlightRecorder,
} from '../services/MeshFlightRecorder';

function formatAge(timestamp?: number): string {
  if (!timestamp) {
    return 'n/a';
  }

  const ageMs = Math.max(0, Date.now() - timestamp);

  if (ageMs < 1000) {
    return `${ageMs}ms ago`;
  }

  return `${Math.floor(ageMs / 1000)}s ago`;
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEventIcon(
  event: MeshFlightRecorderEvent,
): string {
  if (event.level === 'error') {
    return '🔴';
  }

  if (event.level === 'warning') {
    return '🟠';
  }

  if (event.level === 'success') {
    return '🟢';
  }

  return '🔵';
}

function formatEventData(
  event: MeshFlightRecorderEvent,
): string | null {
  if (!event.data) {
    return null;
  }

  const entries = Object.entries(event.data)
    .filter(([, value]) => value !== undefined)
    .slice(0, 8)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        try {
          return `${key}: ${JSON.stringify(value)}`;
        } catch {
          return `${key}: [object]`;
        }
      }

      return `${key}: ${String(value)}`;
    });

  return entries.length > 0
    ? entries.join(' · ')
    : null;
}

function buildMeshTreeLines(selfId: string, nodes: MeshNode[]): string[] {
  const directNodes = nodes
    .filter(node => node.connected || !node.via)
    .sort((a, b) => b.quality - a.quality);

  const remoteNodes = nodes
    .filter(node => !node.connected && !!node.via)
    .sort((a, b) => a.hops - b.hops || b.quality - a.quality);

  const lines = [`📱 You ${selfId}`];

  if (directNodes.length === 0 && remoteNodes.length === 0) {
    lines.push('└── No visible mesh nodes yet');
    return lines;
  }

  directNodes.forEach((directNode, index) => {
    const directBranch = index === directNodes.length - 1 && remoteNodes.length === 0 ? '└──' : '├──';

    lines.push(
      `${directBranch} ${directNode.name || '🙂'} ${directNode.id} · Direct · Q${directNode.quality}`,
    );

    const children = remoteNodes.filter(remoteNode => remoteNode.via === directNode.id);

    children.forEach((child, childIndex) => {
      const isLastChild = childIndex === children.length - 1;
      const spacer = directBranch === '└──' ? '    ' : '│   ';
      const childBranch = isLastChild ? '└──' : '├──';

      lines.push(
        `${spacer}${childBranch} ${child.name || 'remote'} ${child.id} · Hop ${child.hops} · Q${child.quality}`,
      );
    });
  });

  const orphanRemoteNodes = remoteNodes.filter(
    remoteNode => !directNodes.some(directNode => directNode.id === remoteNode.via),
  );

  orphanRemoteNodes.forEach((remoteNode, index) => {
    const branch = index === orphanRemoteNodes.length - 1 ? '└──' : '├──';

    lines.push(
      `${branch} ${remoteNode.name || 'remote'} ${remoteNode.id} · Hop ${remoteNode.hops} via ${remoteNode.via} · Q${remoteNode.quality}`,
    );
  });

  return lines;
}

function getBestRouteMemoryForNode(
  nodeId: string,
  routeMemory: MeshRouteMemoryStats[],
): MeshRouteMemoryStats | null {
  const candidates = routeMemory
    .filter(memory => memory.destinationId === nodeId)
    .sort((a, b) => {
      if (b.confidenceScore !== a.confidenceScore) {
        return b.confidenceScore - a.confidenceScore;
      }

      if (b.selections !== a.selections) {
        return b.selections - a.selections;
      }

      return b.lastObservedAt - a.lastObservedAt;
    });

  return candidates[0] ?? null;
}

function getNeighbourHealthForRoute(
  node: MeshNode,
  neighbourHealth: MeshNeighbourReliabilityStats[],
): MeshNeighbourReliabilityStats | null {
  const healthNodeId = node.connected
    ? node.id
    : node.via;

  if (!healthNodeId) {
    return null;
  }

  return (
    neighbourHealth.find(
      neighbour => neighbour.nodeId === healthNodeId,
    ) ?? null
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function MeshDiagnosticsScreen({
  onBack,
  bleStatus,
  nearbyUsers,
  gattSyncStatus,
}: {
  onBack: () => void;
  bleStatus: string;
  nearbyUsers: NearbyOfflinkUser[];
  gattSyncStatus: {
    state: string;
    targetUserId: string | null;
    targetDeviceId: string | null;
    lastStartedAt: number | null;
    lastSuccessAt: number | null;
    lastFailureAt: number | null;
    lastError: string | null;
  };
}) {
  const [snapshot, setSnapshot] = useState<MeshDiagnosticsSnapshot>(
    getMeshDiagnosticsSnapshot(),
  );
  const [nodes, setNodes] = useState<MeshNode[]>(MeshTopology.getTopology());
  const [selfId, setSelfId] = useState<string>('UNKNOWN_SELF');
  const [neighbourHealth, setNeighbourHealth] = useState<MeshNeighbourReliabilityStats[]>(
    getAllNeighbourReliability(),
  );
  const [routeMemory, setRouteMemory] = useState<MeshRouteMemoryStats[]>(
    getAllRouteMemory(),
  );
  const [flightEvents, setFlightEvents] = useState<
    MeshFlightRecorderEvent[]
  >(getMeshFlightRecorderEvents());

  useEffect(() => {
    loadProfile().then(profile => {
      if (profile?.userId) {
        setSelfId(profile.userId);
      }
    });

    const timer = setInterval(() => {
      setSnapshot(getMeshDiagnosticsSnapshot());
      setNodes(MeshTopology.getTopology());
      setNeighbourHealth(getAllNeighbourReliability());
      setRouteMemory(getAllRouteMemory());
    }, 1000);

    const unsubscribe = MeshTopology.subscribe(() => {
      setNodes(MeshTopology.getTopology());
      setNeighbourHealth(getAllNeighbourReliability());
      setRouteMemory(getAllRouteMemory());
    });

    const unsubscribeFlightRecorder =
      subscribeToMeshFlightRecorder(events => {
        setFlightEvents(events);
      });

    return () => {
      clearInterval(timer);
      unsubscribe();
      unsubscribeFlightRecorder();
    };
  }, []);

  function handleReset() {
    resetMeshDiagnostics();
    setSnapshot(getMeshDiagnosticsSnapshot());
  }

  async function handleExportFlightRecorder() {
    try {
      /*
       * Let the pressed-button frame finish before serialising and
       * opening Android's share sheet.
       */
      await new Promise<void>(resolve => {
        setTimeout(resolve, 100);
      });

      const exported =
        createMeshFlightRecorderExport(250);

      await Share.share({
        title: 'Offlink Flight Recorder',
        message: exported,
      });
    } catch (error) {
      Alert.alert(
        'Export failed',
        String(error),
      );
    }
  }

  function handleClearFlightRecorder() {
    Alert.alert(
      'Clear flight recorder?',
      'This permanently removes the stored mesh event history from this phone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearMeshFlightRecorder()
              .then(() => {
                setFlightEvents([]);
              })
              .catch(error => {
                Alert.alert(
                  'Clear failed',
                  String(error),
                );
              });
          },
        },
      ],
    );
  }

  function handleShowTopologyPayload() {
    const summary = createMeshTopologySummary(selfId, MeshTopology.getTopology());
    const encoded = encodeMeshTopologySummary(summary);

    console.log('OFFLINK_TOPOLOGY_PAYLOAD', encoded);
    console.log('OFFLINK_TOPOLOGY_SUMMARY', JSON.stringify(summary, null, 2));
  }

  async function handlePublishTopologyToGatt() {
    try {
      const encoded = await publishLocalTopology(selfId);

      Alert.alert(
        'Topology published',
        `GATT payload updated.\nLength: ${encoded.length} chars`,
      );
    } catch (error) {
      Alert.alert('Publish failed', String(error));
    }
  }

  async function handleReadTopologyFromNearby() {
    try {
      const payload = await readAndApplyNearbyTopology();

      Alert.alert(
        'Topology read complete',
        payload.startsWith('OLMESH|')
          ? 'Read and applied nearby topology.'
          : 'Read nearby payload, but it was not a topology summary.',
      );

      setNodes(MeshTopology.getTopology());
    } catch (error) {
      Alert.alert('Topology read failed', String(error));
    }
  }

  const lastPacket = snapshot.lastPacket;
  const meshTreeLines = buildMeshTreeLines(selfId, nodes);
  const recentFlightEvents = flightEvents.slice(0, 20);
  const newestFlightEvent = flightEvents[0] ?? null;
  const oldestFlightEvent =
    flightEvents.length > 0
      ? flightEvents[flightEvents.length - 1]
      : null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mesh Diagnostics</Text>
        <Text style={styles.subtitle}>Phase 5.6 topology cockpit • {selfId}</Text>

        <Button label="Back" onPress={onBack} />

        <View style={styles.spacer} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scanner State</Text>

          <StatRow label="BLE status" value={bleStatus} />
          <StatRow
            label="Nearby users"
            value={nearbyUsers.length}
          />

          {nearbyUsers.length === 0 ? (
            <Text style={styles.empty}>
              No BLE advertisements currently detected.
            </Text>
          ) : (
            nearbyUsers.map(user => (
              <View
                key={`${user.userId}-${user.deviceId || 'unknown'}`}
                style={styles.nodeCard}>
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeName}>
                    {user.emoji} {user.userId}
                  </Text>
                  <Text style={styles.healthBadge}>
                    {user.rssi ?? 'n/a'} dBm
                  </Text>
                </View>

                <StatRow
                  label="Mesh ID"
                  value={user.meshId || 'missing'}
                />
                <StatRow
                  label="Device ID"
                  value={user.deviceId || 'missing'}
                />
                <StatRow
                  label="Last advert"
                  value={formatAge(user.lastSeenAt)}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GATT Sync State</Text>

          <StatRow label="State" value={gattSyncStatus.state} />
          <StatRow
            label="Target user"
            value={gattSyncStatus.targetUserId || 'none'}
          />
          <StatRow
            label="Target device"
            value={gattSyncStatus.targetDeviceId || 'none'}
          />
          <StatRow
            label="Last started"
            value={
              gattSyncStatus.lastStartedAt
                ? formatAge(gattSyncStatus.lastStartedAt)
                : 'never'
            }
          />
          <StatRow
            label="Last success"
            value={
              gattSyncStatus.lastSuccessAt
                ? formatAge(gattSyncStatus.lastSuccessAt)
                : 'never'
            }
          />
          <StatRow
            label="Last failure"
            value={
              gattSyncStatus.lastFailureAt
                ? formatAge(gattSyncStatus.lastFailureAt)
                : 'never'
            }
          />

          {gattSyncStatus.lastError ? (
            <Text style={styles.empty}>
              {gattSyncStatus.lastError}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mesh Tree</Text>

          <View style={styles.treeBox}>
            {meshTreeLines.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.treeLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Mesh Topology</Text>

          <StatRow label="Visible nodes" value={nodes.length} />

          {nodes.length === 0 ? (
            <Text style={styles.empty}>
              No mesh nodes visible yet. Start BLE broadcast on another phone, then start scanning.
            </Text>
          ) : (
            nodes.map(node => (
              <View key={node.id} style={styles.nodeCard}>
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeName}>{node.name || '🙂'} {node.id}</Text>
                  <Text
                    style={[
                      styles.nodeBadge,
                      node.connected ? styles.directBadge : styles.remoteBadge,
                    ]}>
                    {node.connected ? 'Direct' : `Hop ${node.hops}`}
                  </Text>
                </View>

                <StatRow label="RSSI" value={`${node.rssi} dBm`} />
                <StatRow label="Last seen" value={formatAge(node.lastSeen)} />
                <StatRow label="Via" value={node.via || 'direct'} />
                <StatRow label="Route" value={node.connected ? 'direct BLE' : `remote via ${node.via}`} />
                <StatRow label="Discovery" value={node.discoveredVia} />
              </View>
            ))
          )}
        </View>


        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mesh Intelligence</Text>

          {nodes.length === 0 ? (
            <Text style={styles.empty}>
              No visible nodes yet. Let BLE scanning and topology sync run to build mesh intelligence.
            </Text>
          ) : (
            nodes.map(node => {
              const memory = getBestRouteMemoryForNode(
                node.id,
                routeMemory,
              );

              const health = getNeighbourHealthForRoute(
                node,
                neighbourHealth,
              );

              const routeLabel = node.connected
                ? 'Direct BLE'
                : `Hop ${node.hops} via ${node.via || 'unknown'}`;

              return (
                <View key={`intelligence-${node.id}`} style={styles.nodeCard}>
                  <View style={styles.nodeHeader}>
                    <Text style={styles.nodeName}>
                      {node.name || '🙂'} {node.id}
                    </Text>

                    <Text style={styles.healthBadge}>
                      {node.connected
                        ? 'Direct'
                        : `Confidence ${memory?.confidenceScore ?? 0}`}
                    </Text>
                  </View>

                  <StatRow label="Selected route" value={routeLabel} />
                  <StatRow label="Quality" value={`Q${node.quality}`} />
                  <StatRow
                    label="Route score"
                    value={node.routeScore ?? node.quality}
                  />
                  <StatRow
                    label="Route reason"
                    value={node.routeReason || 'n/a'}
                  />
                  <StatRow
                    label="Last seen"
                    value={formatAge(node.lastSeen)}
                  />
                  <StatRow
                    label="GATT reliability"
                    value={
                      health
                        ? `${health.score}/100`
                        : 'No data'
                    }
                  />
                  <StatRow
                    label="Learned relay"
                    value={memory?.via ?? 'Not needed yet'}
                  />
                  <StatRow
                    label="Relay confidence"
                    value={
                      memory
                        ? `${memory.confidenceScore}/100`
                        : 'No history'
                    }
                  />
                  <StatRow
                    label="Route observations"
                    value={memory?.observations ?? 0}
                  />
                  <StatRow
                    label="Route selections"
                    value={memory?.selections ?? 0}
                  />
                  <StatRow
                    label="Average relay quality"
                    value={
                      memory
                        ? `Q${memory.averageQuality}`
                        : 'n/a'
                    }
                  />
                  <StatRow
                    label="Last relay observation"
                    value={
                      memory
                        ? formatAge(memory.lastObservedAt)
                        : 'n/a'
                    }
                  />
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Routing Decisions</Text>

          <StatRow label="Remote routes applied" value={snapshot.remoteRoutesApplied} />
          <StatRow label="Skipped: self" value={snapshot.remoteRoutesSkippedSelf} />
          <StatRow label="Skipped: already direct" value={snapshot.remoteRoutesSkippedDirect} />
          <StatRow label="Skipped: weaker route" value={snapshot.remoteRoutesSkippedWorse} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Neighbour Health</Text>

          {neighbourHealth.length === 0 ? (
            <Text style={styles.empty}>
              No GATT reliability data yet. Let nearby sync run, then scores will appear here.
            </Text>
          ) : (
            neighbourHealth.map(neighbour => (
              <View key={neighbour.nodeId} style={styles.nodeCard}>
                <View style={styles.nodeHeader}>
                  <Text style={styles.nodeName}>{neighbour.nodeId}</Text>
                  <Text style={styles.healthBadge}>Score {neighbour.score}</Text>
                </View>

                <StatRow label="GATT successes" value={neighbour.gattSuccesses} />
                <StatRow label="GATT failures" value={neighbour.gattFailures} />
                <StatRow label="Last success" value={formatAge(neighbour.lastSuccessAt ?? undefined)} />
                <StatRow label="Last failure" value={formatAge(neighbour.lastFailureAt ?? undefined)} />
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Packets</Text>

          <StatRow label="Created" value={snapshot.packetsCreated} />
          <StatRow label="Received" value={snapshot.packetsReceived} />
          <StatRow label="Relayed" value={snapshot.packetsRelayed} />
          <StatRow label="Dropped" value={snapshot.packetsDropped} />
          <StatRow label="Duplicates" value={snapshot.duplicatesDropped} />
          <StatRow label="TTL expired" value={snapshot.ttlExpired} />
          <StatRow label="Invalid" value={snapshot.invalidPackets} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Relay Queue</Text>

          <StatRow label="Current queue" value={snapshot.currentQueueSize} />
          <StatRow label="Queue peak" value={snapshot.queuePeak} />
          <StatRow label="Relay failures" value={snapshot.relayFailures} />
          <StatRow
            label="Last relay delay"
            value={
              snapshot.lastRelayDelayMs === null
                ? 'n/a'
                : `${snapshot.lastRelayDelayMs}ms`
            }
          />
          <StatRow
            label="Average delay"
            value={
              snapshot.averageRelayDelayMs === null
                ? 'n/a'
                : `${snapshot.averageRelayDelayMs}ms`
            }
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last Packet</Text>

          {lastPacket ? (
            <>
              <StatRow label="Event" value={lastPacket.event} />
              <StatRow label="Reason" value={lastPacket.reason || 'n/a'} />
              <StatRow label="ID" value={lastPacket.id} />
              <StatRow label="Origin" value={lastPacket.origin} />
              <StatRow label="TTL" value={lastPacket.ttl} />
              <StatRow label="Hop count" value={lastPacket.hopCount} />
              <StatRow label="Age" value={formatAge(lastPacket.timestamp)} />
            </>
          ) : (
            <Text style={styles.empty}>No packets recorded yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 Flight Recorder</Text>

          <StatRow
            label="Stored events"
            value={flightEvents.length}
          />
          <StatRow
            label="Newest event"
            value={
              newestFlightEvent
                ? formatAge(newestFlightEvent.timestamp)
                : 'none'
            }
          />
          <StatRow
            label="Oldest event"
            value={
              oldestFlightEvent
                ? formatAge(oldestFlightEvent.timestamp)
                : 'none'
            }
          />

          <View style={styles.recorderActions}>
            <View style={styles.recorderAction}>
              <Button
                label="Export Recorder"
                onPress={handleExportFlightRecorder}
              />
            </View>

            <View style={styles.recorderAction}>
              <Button
                label="Clear Recorder"
                onPress={handleClearFlightRecorder}
              />
            </View>
          </View>

          <Text style={styles.timelineTitle}>
            Recent events
          </Text>

          {recentFlightEvents.length === 0 ? (
            <Text style={styles.empty}>
              No recorded mesh events yet.
            </Text>
          ) : (
            recentFlightEvents.map(event => {
              const eventData = formatEventData(event);

              return (
                <View
                  key={event.id}
                  style={styles.timelineEvent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineMessage}>
                      {getEventIcon(event)} {event.message}
                    </Text>

                    <Text style={styles.timelineTime}>
                      {formatEventTime(event.timestamp)}
                    </Text>
                  </View>

                  <Text style={styles.timelineType}>
                    {event.type}
                  </Text>

                  {eventData ? (
                    <Text style={styles.timelineData}>
                      {eventData}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Controls</Text>
          <Button label="Log Topology Payload" onPress={handleShowTopologyPayload} />

          <View style={styles.spacer} />

          <Button label="Publish Topology to GATT" onPress={handlePublishTopologyToGatt} />

          <View style={styles.spacer} />

          <Button label="Read Topology From Nearby" onPress={handleReadTopologyFromNearby} />

          <View style={styles.spacer} />

          <Button label="Reset Diagnostics" onPress={handleReset} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scroll: {
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 20,
  },
  spacer: {
    height: 16,
  },
  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 14,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  treeBox: {
    backgroundColor: '#0b0b0b',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  treeLine: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '700',
  },
  nodeCard: {
    backgroundColor: '#0b0b0b',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  nodeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  nodeBadge: {
    color: '#050505',
    backgroundColor: '#fff',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  directBadge: {
    backgroundColor: '#fff',
  },
  remoteBadge: {
    backgroundColor: '#999',
  },
  healthBadge: {
    color: '#050505',
    backgroundColor: '#fff',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },


  recorderActions: {
    marginTop: 16,
    gap: 10,
  },
  recorderAction: {
    width: '100%',
  },
  timelineTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 22,
    marginBottom: 4,
  },
  timelineEvent: {
    backgroundColor: '#0b0b0b',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineMessage: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  timelineTime: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineType: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  timelineData: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  empty: {
    color: '#aaa',
    fontSize: 14,
  },
});
