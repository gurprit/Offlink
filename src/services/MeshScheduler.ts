import {NearbyOfflinkUser} from '../models/types';

type MeshSchedulerOptions = {
  getNearbyUsers: () => NearbyOfflinkUser[];
  startScan: () => () => void;
  syncUser: (user: NearbyOfflinkUser) => Promise<void>;
  publishTopology: () => Promise<void>;
};

const SCAN_WINDOW_MS = 10000;
const RADIO_SETTLE_MS = 1200;
const LOOP_PAUSE_MS = 1500;
const MAX_SYNC_USERS_PER_PASS = 1;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pickSyncUsers(users: NearbyOfflinkUser[]): NearbyOfflinkUser[] {
  return users
    .filter(user => Boolean(user.deviceId))
    .sort((a, b) => (b.rssi ?? -100) - (a.rssi ?? -100))
    .slice(0, MAX_SYNC_USERS_PER_PASS);
}

export function startMeshScheduler(options: MeshSchedulerOptions): () => void {
  let isStopped = false;
  let stopScan: (() => void) | null = null;

  async function stopCurrentScan() {
    if (!stopScan) {
      return;
    }

    stopScan();
    stopScan = null;
    await wait(RADIO_SETTLE_MS);
  }

  async function loop() {
    while (!isStopped) {
      console.log('OFFLINK_MESH_SCHEDULER_SCAN_START');

      stopScan = options.startScan();

      await wait(SCAN_WINDOW_MS);

      if (isStopped) {
        break;
      }

      console.log('OFFLINK_MESH_SCHEDULER_SCAN_STOP');
      await stopCurrentScan();

      const users = pickSyncUsers(options.getNearbyUsers());

      console.log(
        'OFFLINK_MESH_SCHEDULER_SYNC_PASS',
        JSON.stringify({
          count: users.length,
          users: users.map(user => ({
            userId: user.userId,
            meshId: user.meshId,
            deviceId: user.deviceId,
            rssi: user.rssi,
          })),
        }),
      );

      for (const user of users) {
        if (isStopped) {
          break;
        }

        try {
          await options.syncUser(user);
        } catch (error) {
          console.log(
            'OFFLINK_MESH_SCHEDULER_SYNC_ERROR',
            JSON.stringify({
              userId: user.userId,
              deviceId: user.deviceId,
              error: String(error),
            }),
          );
        }

        await wait(RADIO_SETTLE_MS);
      }

      if (!isStopped) {
        try {
          console.log('OFFLINK_MESH_SCHEDULER_PUBLISH');
          await options.publishTopology();
        } catch (error) {
          console.log('OFFLINK_MESH_SCHEDULER_PUBLISH_ERROR', String(error));
        }
      }

      await wait(LOOP_PAUSE_MS);
    }

    await stopCurrentScan();
    console.log('OFFLINK_MESH_SCHEDULER_STOPPED');
  }

  loop().catch(error => {
    console.log('OFFLINK_MESH_SCHEDULER_FATAL', String(error));
  });

  return () => {
    isStopped = true;

    if (stopScan) {
      stopScan();
      stopScan = null;
    }
  };
}
