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
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};


export type OfflinkSighting = {
  userId: string;
  emoji: string;
  lastSeenAt: number;
  updatedAt: number;
  seenBy: string;
  source: 'direct' | 'mesh';
  rssi?: number;
  hops?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};
