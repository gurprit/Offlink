# 🛰️ Offlink

> **An experimental offline Bluetooth mesh network for finding friends without internet, mobile signal or Wi-Fi.**

![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android)
![React Native](https://img.shields.io/badge/React%20Native-0.8x-61DAFB?logo=react)
![Status](https://img.shields.io/badge/Status-Experimental-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

---

# Overview

Offlink is an experimental Android application that allows devices to exchange location information entirely offline using Bluetooth Low Energy.

Instead of relying on mobile networks or cloud servers, nearby devices exchange mesh packets directly with one another and relay information throughout a crowd.

The long-term goal is to allow friends to locate one another at places where internet access is unavailable or unreliable, including:

- 🎵 Music festivals
- 🏕️ Hiking
- 🏟 Sporting events
- 🎮 Conventions
- 🚨 Emergency situations
- 🌍 Disaster recovery

---

# How It Works

```text
BLE Advertisement
        │
        ▼
Discover nearby devices
        │
        ▼
Bluetooth GATT Connection
        │
        ▼
Exchange Mesh Packets
        │
        ▼
Merge Sighting Database
        │
        ▼
Queue Relay Packet
        │
        ▼
Forward to next nearby device
```

---

# Architecture

```text
                           Offlink

┌──────────────────────────────────────────────────────┐
│                      App.tsx                         │
│                                                      │
│  • Friends                                           │
│  • Nearby Users                                      │
│  • Sightings                                         │
│  • Current Location                                  │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                  BLE Discovery                       │
│                                                      │
│ Broadcast:                                           │
│                                                      │
│     OL | UserID | Emoji                              │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                  GATT Transport                      │
│                                                      │
│ Rich mesh packet exchange                            │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                   Mesh Engine                        │
│                                                      │
│ • Packet IDs                                         │
│ • TTL                                                │
│ • Duplicate Detection                                │
│ • Relay Decisions                                    │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                 Mesh Sync Service                    │
│                                                      │
│ Merge sightings                                       │
│ Update database                                       │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                 Mesh Relay Queue                     │
│                                                      │
│ Queue packets awaiting forwarding                    │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                 Mesh Dispatcher                      │
│                                                      │
│ Event-driven packet transmission                     │
└──────────────────────────────────────────────────────┘
```

---

# Mesh Packet Format

```json
{
  "id": "MQVJ6VCP-CR434K8A",
  "origin": "OL-1ABNVZ",
  "ttl": 5,
  "timestamp": 1782514639000,
  "payload": {
    "senderId": "OL-1ABNVZ",
    "createdAt": 1782514639000,
    "sightings": [
      {
        "userId": "...",
        "latitude": 51.5,
        "longitude": -0.12
      }
    ]
  }
}
```

---

# Current Features

| Feature | Status |
|---------|:------:|
| BLE Advertising | ✅ |
| BLE Discovery | ✅ |
| Bluetooth GATT Transport | ✅ |
| Friend Detection | ✅ |
| Nearby Sightings | ✅ |
| Offline Map | ✅ |
| Mesh Packet Protocol | ✅ |
| Packet IDs | ✅ |
| Time-To-Live (TTL) | ✅ |
| Duplicate Detection | ✅ |
| Relay Queue | ✅ |
| Event-Driven Dispatch | ✅ |
| Two Device Testing | ✅ |

---

# Current Development Roadmap

## ✅ Phase 1

- Project setup
- React Native
- Android

## ✅ Phase 2

- Bluetooth discovery
- BLE advertisements

## ✅ Phase 3

- Bluetooth GATT transport
- Mesh payload exchange

## ✅ Phase 4

- Mesh packet protocol
- Packet IDs
- TTL
- Duplicate detection
- Relay queue
- Event-driven dispatcher

## 🚧 Phase 5

- Reliable GATT transport
- Connection manager
- Retry logic
- Connection cooldowns

## 📋 Planned

- Multi-hop routing
- Store-and-forward networking
- Packet acknowledgements
- Routing optimisation
- Battery optimisation
- Encryption
- Group messaging
- Offline chat
- Emergency broadcast mode

---

# Design Philosophy

BLE advertisements remain intentionally tiny.

```text
BLE
↓

"I exist."
```

Everything else happens over GATT.

```text
GATT
↓

Everything interesting.
```

This keeps Bluetooth advertisements within Android's strict payload limits while allowing the mesh protocol to evolve independently.

---

# Long-Term Vision

Imagine a festival:

```text
🙂────🙂────🙂
│           │
🙂────🙂────🙂
      │
      ⭐
```

Alice never comes into Bluetooth range of Bob.

Instead, her location propagates naturally through nearby Offlink users until it eventually reaches Bob.

No internet.

No servers.

No mobile signal.

Just people carrying information through the crowd.

---

# Technology

- React Native
- TypeScript
- Bluetooth Low Energy
- Bluetooth GATT
- MapLibre
- Android

---

# Current Status

> Experimental

The project is under active development and currently focuses on building a reliable Bluetooth mesh transport layer before introducing larger-scale multi-hop networking.

EOF

echo "✅ README updated."
````
