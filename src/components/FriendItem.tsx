import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {OfflinkFriend} from '../models/types';

type FriendItemProps = {
  friend: OfflinkFriend;
  onRemove: (userId: string) => void;
};

export function FriendItem({friend, onRemove}: FriendItemProps) {
  return (
    <View style={styles.friendRow}>
      <Text style={styles.friendEmoji}>{friend.emoji}</Text>

      <View style={styles.friendTextWrap}>
        <Text style={styles.friendName}>Emoji friend</Text>
        <Text style={styles.friendId}>{friend.userId}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onRemove(friend.userId)}>
        <Text style={styles.deleteText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  friendRow: {
    backgroundColor: '#0b0b0b',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendEmoji: {
    fontSize: 38,
    marginRight: 12,
  },
  friendTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  friendId: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '800',
  },
});