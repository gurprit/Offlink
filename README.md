# 🛰️ Offlink

> **An experimental offline Bluetooth mesh network for finding friends without internet, mobile signal or Wi-Fi.**

![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android)
![React Native](https://img.shields.io/badge/React%20Native-TypeScript-61DAFB?logo=react)
![Status](https://img.shields.io/badge/Status-Experimental-orange)
![Mesh](https://img.shields.io/badge/Mesh-Multi--Hop-success)
![License](https://img.shields.io/badge/License-MIT-blue)

---

# Overview

Offlink is an experimental Android application that creates an **offline Bluetooth mesh network** capable of sharing friend sightings without mobile data, Wi-Fi or internet.

Nearby devices discover one another using Bluetooth Low Energy before automatically opening Bluetooth GATT sessions to exchange mesh information.

Each device becomes part of a decentralised network that can relay information across multiple hops, allowing sightings to spread naturally through a crowd.

The project is designed for environments where connectivity cannot be relied upon, including:

- 🎵 Music festivals
- 🏕 Hiking and camping
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
Discover Nearby Devices
        │
        ▼
Mesh Scheduler
        │
        ▼
Bluetooth GATT Session
        │
        ▼
Bidirectional Topology Exchange
        │
        ▼
Mesh Packet Exchange
        │
        ▼
Merge Friend Sightings
        │
        ▼
Relay Through Mesh
```

---

# Architecture

```text
                           Offlink

                 ┌────────────────────┐
                 │     Home Screen    │
                 └──────────┬─────────┘
                            │
                            ▼
                 ┌────────────────────┐
                 │   BLE Advertising  │
                 │  Tiny discovery    │
                 └──────────┬─────────┘
                            │
                            ▼
                 ┌────────────────────┐
                 │   BLE Discovery    │
                 └──────────┬─────────┘
                            │
                            ▼
                 ┌────────────────────┐
                 │   Mesh Scheduler   │
                 │ Scan • Sync • Wait │
                 └──────────┬─────────┘
                            │
          ┌─────────────────┴──────────────────┐
          ▼                                    ▼
┌────────────────────┐              ┌────────────────────┐
│  Mesh Topology     │              │   GATT Transport   │
│ Route Selection    │              │ Chunked Payloads   │
└──────────┬─────────┘              └──────────┬─────────┘
           │                                   │
           └──────────────┬────────────────────┘
                          ▼
               ┌────────────────────┐
               │ Mesh Transport     │
               │ Packet Processing  │
               └──────────┬─────────┘
                          ▼
               ┌────────────────────┐
               │ Relay Queue        │
               │ ACK Generation     │
               └──────────┬─────────┘
                          ▼
               ┌────────────────────┐
               │ Friend Sightings   │
               │ Offline Database   │
               └──────────┬─────────┘
                          ▼
               ┌────────────────────┐
               │ Map + Diagnostics  │
               └────────────────────┘
```

---

# Mesh Transport

Each mesh packet contains routing information allowing it to travel across multiple devices.

```json
{
  "id": "MRGKQQLX-WONP5FQG",
  "origin": "OL-1ABNVZ",
  "ttl": 5,
  "hopCount": 0,
  "timestamp": 1783787035000,
  "payload": {
    "kind": "sightings",
    "senderId": "OL-1ABNVZ",
    "createdAt": 1783787035000,
    "sightings": [
      {
        "userId": "OL-833JLV",
        "latitude": 51.503,
        "longitude": -0.119
      }
    ]
  }
}
```

Packets include:

- Unique IDs
- Duplicate detection
- Time-To-Live (TTL)
- Hop counting
- Automatic acknowledgements
- Relay decisions

---

# Current Features

| Feature | Status |
|---------|:------:|
| BLE Advertising | ✅ |
| BLE Discovery | ✅ |
| Bluetooth GATT Transport | ✅ |
| Chunked GATT Payloads (>512 bytes) | ✅ |
| Dynamic Mesh Topology | ✅ |
| Multi-Hop Routing | ✅ |
| Route Quality Scoring | ✅ |
| Bidirectional Peer Sessions | ✅ |
| Packet Relay | ✅ |
| ACK Generation | ✅ |
| ACK Relay | ✅ |
| Duplicate Detection | ✅ |
| Mesh Scheduler | ✅ |
| Offline Friend Sightings | ✅ |
| Offline Map | ✅ |
| Mesh Diagnostics Screen | ✅ |
| Multi-Device Testing | ✅ |

---

# Development Progress

## ✅ Phase 1

- Project setup
- React Native
- Android

## ✅ Phase 2

- BLE discovery
- BLE advertising

## ✅ Phase 3

- Friend sightings
- Offline map
- Local storage

## ✅ Phase 4

- Bluetooth GATT transport
- Mesh payload exchange

## ✅ Phase 5

### Reliable Mesh Transport

- Reliable GATT sessions
- Connection throttling
- Retry logic
- Connection backoff

### Mesh Topology

- Dynamic neighbour graph
- Route quality scoring
- Remote topology exchange
- Multi-hop routing

### Payload Transport

- Payload multiplexing
- Payload bundles
- Chunked GATT transport
- Large payload support

### Bidirectional Sessions

- Topology upload
- Topology download
- ACK creation
- ACK relay
- Bidirectional peer synchronisation

---

# Planned

- 📦 Store-and-forward networking
- 🚚 Opportunistic delivery
- 🔒 End-to-end encryption
- 👥 Group messaging
- 💬 Offline chat
- 📍 Friend requests over mesh
- 📢 Emergency broadcast mode
- 🔋 Battery optimisation
- 📈 Delivery statistics
- 🌍 Large-scale festival testing

---

# Design Philosophy

Bluetooth advertisements stay intentionally tiny.

```text
BLE

↓

"I exist."
```

Everything else happens over Bluetooth GATT.

```text
GATT

↓

Topology
Mesh packets
ACKs
Friend sightings
Relay queue
```

Keeping advertisements small improves compatibility while allowing the mesh protocol to evolve independently.

---

# Long-Term Vision

Imagine a festival with thousands of people.

```text
🙂────🙂────🙂
│           │
🙂────🙂────🙂
      │
      ⭐
```

Alice never comes into Bluetooth range of Bob.

Instead, her location propagates naturally through nearby Offlink users.

Every phone stores, relays and forwards information until it eventually reaches Bob.

No internet.

No servers.

No mobile signal.

Just people carrying information for one another through a self-organising Bluetooth mesh.

---

# Technology

- React Native
- TypeScript
- Bluetooth Low Energy (BLE)
- Bluetooth GATT
- MapLibre
- Android

---

# Current Status

> **Experimental**

Offlink now supports reliable Bluetooth mesh communication with dynamic topology discovery, multi-hop routing, chunked payload transport, acknowledgements and live mesh diagnostics.

The current focus is expanding the network into a fully delay-tolerant **store-and-forward mesh** capable of operating across large crowds and challenging real-world environments.
