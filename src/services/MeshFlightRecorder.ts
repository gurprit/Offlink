import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'offlink_mesh_flight_recorder_v1';
const MAX_EVENTS = 1000;

export type MeshFlightRecorderLevel =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type MeshFlightRecorderEventType =
  | 'session_started'
  | 'session_stopped'
  | 'neighbour_seen'
  | 'neighbour_lost'
  | 'gatt_success'
  | 'gatt_failure'
  | 'route_observed'
  | 'route_selected'
  | 'route_changed'
  | 'route_expired'
  | 'topology_received'
  | 'topology_stale'
  | 'packet_created'
  | 'packet_received'
  | 'packet_relayed'
  | 'packet_dropped'
  | 'friend_location_created'
  | 'friend_location_received'
  | 'friend_location_applied'
  | 'friend_location_relayed'
  | 'custom';

export type MeshFlightRecorderEvent = {
  id: string;
  timestamp: number;
  type: MeshFlightRecorderEventType;
  level: MeshFlightRecorderLevel;
  message: string;
  data?: Record<string, unknown>;
};

export type RecordMeshFlightEventArgs = {
  type: MeshFlightRecorderEventType;
  message: string;
  level?: MeshFlightRecorderLevel;
  data?: Record<string, unknown>;
};

type MeshFlightRecorderListener = (
  events: MeshFlightRecorderEvent[],
) => void;

let events: MeshFlightRecorderEvent[] = [];
let hasLoaded = false;
let loadPromise: Promise<void> | null = null;
let persistPromise: Promise<void> = Promise.resolve();

const listeners = new Set<MeshFlightRecorderListener>();

let notificationScheduled = false;

function generateEventId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 9)
  ).toUpperCase();
}

function sanitiseData(
  data?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!data) {
    return undefined;
  }

  const sanitised: Record<string, unknown> = {};

  Object.entries(data).forEach(([key, value]) => {
    /*
     * Precise coordinates are deliberately excluded from the recorder.
     * Field logs should explain mesh behaviour without becoming a
     * location-history archive.
     */
    if (
      key === 'latitude' ||
      key === 'longitude' ||
      key === 'coordinates'
    ) {
      return;
    }

    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitised[key] = value;
      return;
    }

    if (Array.isArray(value)) {
      sanitised[key] = value.slice(0, 25);
      return;
    }

    if (typeof value === 'object') {
      sanitised[key] = value;
    }
  });

  return Object.keys(sanitised).length > 0
    ? sanitised
    : undefined;
}

function notifyListeners(): void {
  const snapshot = getMeshFlightRecorderEvents();

  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch (error) {
      console.log(
        'OFFLINK_FLIGHT_RECORDER_LISTENER_ERROR',
        String(error),
      );
    }
  });
}

function scheduleListenerNotification(): void {
  if (notificationScheduled) {
    return;
  }

  notificationScheduled = true;

  setTimeout(() => {
    notificationScheduled = false;
    notifyListeners();
  }, 0);
}

function queuePersist(): void {
  const snapshot = events.slice(-MAX_EVENTS);

  persistPromise = persistPromise
    .catch(() => {
      // Keep the persistence queue alive after a failed write.
    })
    .then(async () => {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(snapshot),
      );
    })
    .catch(error => {
      console.log(
        'OFFLINK_FLIGHT_RECORDER_PERSIST_ERROR',
        String(error),
      );
    });
}

function isValidStoredEvent(
  value: unknown,
): value is MeshFlightRecorderEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<MeshFlightRecorderEvent>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.level === 'string' &&
    typeof candidate.message === 'string'
  );
}

export async function initialiseMeshFlightRecorder(): Promise<void> {
  if (hasLoaded) {
    return;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          events = parsed
            .filter(isValidStoredEvent)
            .slice(-MAX_EVENTS);
        }
      }
    } catch (error) {
      console.log(
        'OFFLINK_FLIGHT_RECORDER_LOAD_ERROR',
        String(error),
      );

      events = [];
    } finally {
      hasLoaded = true;
      loadPromise = null;
      scheduleListenerNotification();
    }
  })();

  return loadPromise;
}

export function recordMeshFlightEvent({
  type,
  message,
  level = 'info',
  data,
}: RecordMeshFlightEventArgs): MeshFlightRecorderEvent {
  const event: MeshFlightRecorderEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    type,
    level,
    message,
    data: sanitiseData(data),
  };

  events = [...events, event].slice(-MAX_EVENTS);

  console.log(
    'OFFLINK_FLIGHT_RECORDER_EVENT',
    JSON.stringify(event),
  );

  scheduleListenerNotification();
  queuePersist();

  return {...event};
}

export function getMeshFlightRecorderEvents(): MeshFlightRecorderEvent[] {
  return events
    .map(event => ({
      ...event,
      data: event.data ? {...event.data} : undefined,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getRecentMeshFlightRecorderEvents(
  limit = 50,
): MeshFlightRecorderEvent[] {
  const safeLimit = Math.max(
    0,
    Math.min(MAX_EVENTS, Math.floor(limit)),
  );

  return getMeshFlightRecorderEvents().slice(0, safeLimit);
}

export function getMeshFlightRecorderEventCount(): number {
  return events.length;
}

export function getMeshFlightRecorderOldestTimestamp(): number | null {
  if (events.length === 0) {
    return null;
  }

  return events.reduce(
    (oldest, event) =>
      Math.min(oldest, event.timestamp),
    events[0].timestamp,
  );
}

export function getMeshFlightRecorderNewestTimestamp(): number | null {
  if (events.length === 0) {
    return null;
  }

  return events.reduce(
    (newest, event) =>
      Math.max(newest, event.timestamp),
    events[0].timestamp,
  );
}

export function createMeshFlightRecorderExport(
  maxEvents = 250,
): string {
  const safeLimit = Math.max(
    1,
    Math.min(MAX_EVENTS, Math.floor(maxEvents)),
  );

  const allEvents = getMeshFlightRecorderEvents();
  const exportedEvents = allEvents
    .slice(0, safeLimit)
    .reverse();

  const eventCounts = allEvents.reduce<
    Record<string, number>
  >((counts, event) => {
    counts[event.type] =
      (counts[event.type] ?? 0) + 1;

    return counts;
  }, {});

  return JSON.stringify(
    {
      format: 'offlink-mesh-flight-recorder',
      version: 1,
      exportedAt: Date.now(),
      storedEventCount: allEvents.length,
      exportedEventCount: exportedEvents.length,
      omittedEventCount: Math.max(
        0,
        allEvents.length - exportedEvents.length,
      ),
      exportWindow: 'newest-events',
      eventCounts,
      events: exportedEvents,
    },
    null,
    2,
  );
}

export async function clearMeshFlightRecorder(): Promise<void> {
  events = [];
  scheduleListenerNotification();

  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.log(
      'OFFLINK_FLIGHT_RECORDER_CLEAR_ERROR',
      String(error),
    );

    throw error;
  }
}

export function subscribeToMeshFlightRecorder(
  listener: MeshFlightRecorderListener,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
