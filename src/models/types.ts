export type OfflinkProfile = {
  userId: string;
  emoji: string;
};

export type OfflinkFriend = {
  userId: string;
  emoji: string;
  addedAt: number;
};

export type NearbyOfflinkUser = {
  userId: string;
  emoji: string;
  lastSeenAt: number;
  rssi?: number;
};
