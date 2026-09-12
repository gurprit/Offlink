import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Path, Text as SvgText} from 'react-native-svg';
import {OfflinkSighting} from '../models/types';
import {HeadingUpdate, subscribeToHeading} from '../services/HeadingService';
import {OfflinkLocation} from '../services/LocationService';

const VIEW_SIZE = 360;
const ORIGIN_X = VIEW_SIZE / 2;
const ORIGIN_Y = 322;
const MAX_RADIUS = 156;
const MIN_RADIUS = 34;
const RADAR_RANGE_METRES = 100;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normaliseAngle(value: number): number {
  let angle = value % 360;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

function distanceMetres(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const earthRadius = 6371000;
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const deltaLon = toRadians(toLon - fromLon);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function formatDistance(distance: number): string {
  if (distance < 5) return 'VERY CLOSE';
  if (distance < 10) return 'NEARBY';
  if (distance < 100) return `${Math.round(distance)}m`;
  if (distance < 1000) return `${Math.round(distance)}m+`;
  return `${(distance / 1000).toFixed(1)}km`;
}

export function FriendRadar({
  friendSightings,
  currentLocation,
}: {
  friendSightings: OfflinkSighting[];
  currentLocation: OfflinkLocation | null;
}) {
  const [heading, setHeading] = useState(0);
  const [headingAvailable, setHeadingAvailable] = useState(false);

  useEffect(() => {
    const subscription = subscribeToHeading((update: HeadingUpdate) => {
      if (Number.isFinite(update.heading)) {
        setHeading(update.heading);
        setHeadingAvailable(true);
      }
    });

    return () => subscription.remove();
  }, []);

  const radarFriends = useMemo(() => {
    if (!currentLocation) return [];

    return friendSightings
      .filter(
        sighting =>
          typeof sighting.latitude === 'number' &&
          typeof sighting.longitude === 'number',
      )
      .map(sighting => {
        const distance = distanceMetres(
          currentLocation.latitude,
          currentLocation.longitude,
          sighting.latitude!,
          sighting.longitude!,
        );
        const absoluteBearing = bearingDegrees(
          currentLocation.latitude,
          currentLocation.longitude,
          sighting.latitude!,
          sighting.longitude!,
        );
        const relativeBearing = normaliseAngle(absoluteBearing - heading);
        const behind = Math.abs(relativeBearing) > 90;
        const displayBearing = Math.max(-90, Math.min(90, relativeBearing));
        const distanceRatio =
          Math.min(distance, RADAR_RANGE_METRES) / RADAR_RANGE_METRES;
        const radius = MIN_RADIUS + distanceRatio * (MAX_RADIUS - MIN_RADIUS);
        const angle = toRadians(displayBearing);

        return {
          ...sighting,
          distance,
          behind,
          x: ORIGIN_X + Math.sin(angle) * radius,
          y: ORIGIN_Y - Math.cos(angle) * radius,
        };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [currentLocation, friendSightings, heading]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <Text style={styles.headingLabel}>
          {headingAvailable ? `${Math.round(heading)}°` : 'Compass…'}
        </Text>
        <Text style={styles.headingHint}>Point the top of your phone ahead</Text>
      </View>

      <View style={styles.radarFrame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}>
          <Path d={`M 24 ${ORIGIN_Y} A 156 156 0 0 1 336 ${ORIGIN_Y}`} fill="none" stroke="#333333" strokeWidth="2" />
          <Path d={`M 63 ${ORIGIN_Y} A 117 117 0 0 1 297 ${ORIGIN_Y}`} fill="none" stroke="#252525" strokeWidth="1.5" />
          <Path d={`M 102 ${ORIGIN_Y} A 78 78 0 0 1 258 ${ORIGIN_Y}`} fill="none" stroke="#252525" strokeWidth="1.5" />
          <Path d={`M 141 ${ORIGIN_Y} A 39 39 0 0 1 219 ${ORIGIN_Y}`} fill="none" stroke="#252525" strokeWidth="1.5" />

          <Line x1={ORIGIN_X} y1={ORIGIN_Y} x2={ORIGIN_X} y2="154" stroke="#242424" strokeWidth="1" />
          <Line x1={ORIGIN_X} y1={ORIGIN_Y} x2="24" y2={ORIGIN_Y} stroke="#242424" strokeWidth="1" />
          <Line x1={ORIGIN_X} y1={ORIGIN_Y} x2="336" y2={ORIGIN_Y} stroke="#242424" strokeWidth="1" />

          <SvgText x="180" y="148" fill="#8b5cf6" fontSize="11" fontWeight="900" textAnchor="middle">AHEAD</SvgText>
          <SvgText x="77" y="236" fill="#666666" fontSize="9" fontWeight="700" textAnchor="middle">75m</SvgText>
          <SvgText x="118" y="277" fill="#666666" fontSize="9" fontWeight="700" textAnchor="middle">50m</SvgText>
          <SvgText x="151" y="307" fill="#666666" fontSize="9" fontWeight="700" textAnchor="middle">25m</SvgText>

          {radarFriends.map(friend => {
            const close = friend.distance < 10;
            const veryClose = friend.distance < 5;
            const labelY = Math.max(18, friend.y - 25);

            return (
              <React.Fragment key={`${friend.userId}-${friend.updatedAt}`}>
                {close ? (
                  <Circle cx={friend.x} cy={friend.y} r={veryClose ? 25 : 21} fill="rgba(139,92,246,0.16)" stroke="#8b5cf6" strokeWidth="2" />
                ) : null}
                <Circle cx={friend.x} cy={friend.y} r={close ? 17 : 13} fill="#ffffff" stroke={friend.behind ? '#666666' : '#8b5cf6'} strokeWidth="3" />
                <SvgText x={friend.x} y={friend.y + 6} fill="#050505" fontSize={close ? '18' : '14'} textAnchor="middle">
                  {friend.emoji || '●'}
                </SvgText>
                <SvgText x={friend.x} y={labelY} fill="#ffffff" fontSize="10" fontWeight="900" textAnchor="middle">
                  {(friend.displayName || friend.userId).slice(0, 14)}
                </SvgText>
                <SvgText x={friend.x} y={labelY + 12} fill={veryClose ? '#ffffff' : '#8b5cf6'} fontSize="9" fontWeight="900" textAnchor="middle">
                  {friend.behind ? `BEHIND · ${formatDistance(friend.distance)}` : formatDistance(friend.distance)}
                </SvgText>
              </React.Fragment>
            );
          })}

          <Circle cx={ORIGIN_X} cy={ORIGIN_Y} r="22" fill="#050505" stroke="#ffffff" strokeWidth="3" />
          <Path d={`M ${ORIGIN_X} ${ORIGIN_Y - 14} L ${ORIGIN_X - 7} ${ORIGIN_Y + 5} L ${ORIGIN_X} ${ORIGIN_Y + 1} L ${ORIGIN_X + 7} ${ORIGIN_Y + 5} Z`} fill="#ffffff" />
          <SvgText x={ORIGIN_X} y={ORIGIN_Y + 36} fill="#ffffff" fontSize="10" fontWeight="900" textAnchor="middle">YOU</SvgText>
        </Svg>

        {!currentLocation ? (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>Waiting for your location…</Text>
            <Text style={styles.emptyText}>Radar needs your GPS position before it can calculate distance and direction.</Text>
          </View>
        ) : radarFriends.length === 0 ? (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyTitle}>No friends on radar yet</Text>
            <Text style={styles.emptyText}>Friends will appear here as their locations arrive through Offlink.</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.footer}>
        100m close-range radar · friends farther away sit on the outer edge
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1},
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headingLabel: {color: '#ffffff', fontSize: 13, fontWeight: '900'},
  headingHint: {color: '#777777', fontSize: 11, fontWeight: '700'},
  radarFrame: {
    backgroundColor: '#0a0a0a',
    borderColor: '#2f2f2f',
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    minHeight: 350,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyOverlay: {
    backgroundColor: 'rgba(5,5,5,0.9)',
    borderColor: '#333333',
    borderRadius: 20,
    borderWidth: 1,
    left: 24,
    padding: 16,
    position: 'absolute',
    right: 24,
    top: 60,
  },
  emptyTitle: {color: '#ffffff', fontSize: 16, fontWeight: '900'},
  emptyText: {
    color: '#aaaaaa',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 5,
  },
  footer: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
