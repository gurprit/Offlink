import React, {useEffect, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {MeshDiagnosticsSnapshot} from '../models/types';
import {MeshNode} from '../models/MeshNode';
import MeshTopology from '../services/MeshTopology';
import {loadProfile} from '../services/StorageService';
import {createMeshTopologySummary, encodeMeshTopologySummary} from '../services/MeshTopologyProtocol';
import {publishLocalTopology, readAndApplyNearbyTopology} from '../services/MeshTopologyExchangeService';
import {getAllNeighbourReliability, MeshNeighbourReliabilityStats} from '../services/MeshNeighbourReliability';
import {
  getMeshDiagnosticsSnapshot,
  resetMeshDiagnostics,
} from '../services/MeshDiagnosticsService';

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

export function MeshDiagnosticsScreen({onBack}: {onBack: () => void}) {
  const [snapshot, setSnapshot] = useState<MeshDiagnosticsSnapshot>(
    getMeshDiagnosticsSnapshot(),
  );
  const [nodes, setNodes] = useState<MeshNode[]>(MeshTopology.getTopology());
  const [selfId, setSelfId] = useState<string>('UNKNOWN_SELF');
  const [neighbourHealth, setNeighbourHealth] = useState<MeshNeighbourReliabilityStats[]>(
    getAllNeighbourReliability(),
  );

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
    }, 1000);

    const unsubscribe = MeshTopology.subscribe(() => {
      setNodes(MeshTopology.getTopology());
      setNeighbourHealth(getAllNeighbourReliability());
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  function handleReset() {
    resetMeshDiagnostics();
    setSnapshot(getMeshDiagnosticsSnapshot());
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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mesh Diagnostics</Text>
        <Text style={styles.subtitle}>Phase 5.6 topology cockpit • {selfId}</Text>

        <Button label="Back" onPress={onBack} />

        <View style={styles.spacer} />

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


  empty: {
    color: '#aaa',
    fontSize: 14,
  },
});
