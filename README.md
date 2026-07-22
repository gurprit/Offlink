<div align="center">

# 🛰️ Offlink

### Offline Friend Finding over a Self-Organising Bluetooth Mesh Network

**Find friends without internet, mobile signal or Wi-Fi.**

<br>

![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android)
![React Native](https://img.shields.io/badge/React%20Native-TypeScript-61DAFB?logo=react)
![Status](https://img.shields.io/badge/Status-Alpha-yellow)
![Mesh](https://img.shields.io/badge/Mesh-Multi--Hop-success)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

> [!NOTE]
> **Offlink is currently in Alpha.**
>
> The core networking engine is complete and real-world testing is now underway to improve reliability, scalability and user experience before a wider public release.

---

# 📚 Contents

- [Overview](#-overview)
- [Why Offlink?](#-why-offlink)
- [Screenshots](#-screenshots)
- [Current Features](#-current-features)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Mesh Design](#-mesh-design)
- [Development Progress](#-development-progress)
- [Roadmap](#-roadmap)
- [Technology](#-technology)
- [Long-Term Vision](#-long-term-vision)

---

# 🌍 Overview

Offlink is an Android application that allows friends to locate one another completely offline.

Instead of relying on mobile networks, Wi-Fi or cloud servers, nearby devices discover each other using Bluetooth Low Energy before automatically establishing Bluetooth GATT connections to exchange information.

Each phone becomes part of a decentralised Bluetooth mesh capable of relaying information across multiple hops, allowing friend sightings to spread naturally through a crowd.

As more people use Offlink, the mesh becomes stronger.

No infrastructure.

No servers.

No internet.

---

# 🎯 Why Offlink?

Mobile networks often become unreliable where thousands of people gather.

Whether it's a music festival, sporting event or emergency situation, staying connected can become surprisingly difficult.

Offlink is designed to continue working even when traditional communication cannot.

Typical use cases include:

- 🎵 Music festivals
- 🏕 Hiking & camping
- 🏟 Sporting events
- 🎮 Gaming conventions
- 🚨 Emergency response
- 🌍 Disaster recovery

---

# 📱 Screenshots

> Screenshots will be added alongside the first Google Play Alpha release.

| Friend Map | Friends Dashboard | User Profile |
|------------|------------------|--------------|
| Coming Soon | Coming Soon | Coming Soon |

---

# ✨ Current Features

<details open>
<summary><strong>👤 User Profiles</strong></summary>

- Emoji identity
- Editable display names
- QR friend adding
- Local friend management

</details>

<details open>
<summary><strong>📍 Friend Tracking</strong></summary>

- Live friend dashboard
- Offline friend sightings
- Last seen timestamps
- Offline map
- Direct vs relayed friend visibility

</details>

<details open>
<summary><strong>🛰 Bluetooth Mesh Networking</strong></summary>

- Bluetooth Low Energy discovery
- Bluetooth GATT synchronisation
- Dynamic mesh topology
- Adaptive route selection
- Multi-hop routing
- Store-and-forward propagation
- Packet acknowledgements
- Duplicate detection
- Relay decisions
- Route quality scoring
- Chunked payload transport

</details>

<details open>
<summary><strong>🔧 Developer Tools</strong></summary>

- Live mesh diagnostics
- Mesh topology viewer
- Flight recorder
- Network statistics
- Multi-device testing

</details>

---

# 🔄 How It Works

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
Topology Exchange
        │
        ▼
Friend Data Exchange
        │
        ▼
Merge Mesh Data
        │
        ▼
Relay Across Network
```

---

# 🏗 Architecture

```text
                    OFFLINK

            Home Screen + Friend Map
                     │
                     ▼
             BLE Advertising
                     │
                     ▼
             BLE Discovery
                     │
                     ▼
             Mesh Scheduler
                     │
      ┌──────────────┴──────────────┐
      ▼                             ▼
Mesh Topology                 GATT Transport
Route Selection             Chunked Payloads
      │                             │
      └──────────────┬──────────────┘
                     ▼
              Mesh Transport
             Packet Processing
                     │
                     ▼
              Store & Forward
              Relay Decisions
                     │
                     ▼
              Friend Database
                     │
                     ▼
        Friend Map • Dashboard • Diagnostics
```

---

# 🛰 Mesh Design

> [!TIP]
> Bluetooth advertisements intentionally remain extremely small.
>
> Rich profile information, routing data and friend sightings are exchanged later using Bluetooth GATT.

### BLE Advertisement

```text
"I exist."
```

### Bluetooth GATT

```text
Friend profiles
Mesh topology
Friend sightings
Routing information
Packet acknowledgements
Store-and-forward payloads
```

Keeping BLE advertisements tiny improves compatibility while allowing the mesh protocol to evolve independently.

---

# 📦 Example Mesh Packet

```json
{
  "id": "MRGKQQLX-WONP5FQG",
  "origin": "OL-1ABNVZ",
  "ttl": 5,
  "hopCount": 0,
  "timestamp": 1783787035000,
  "payload": {
    "kind": "sightings",
    "senderId": "OL-1ABNVZ"
  }
}
```

Each packet supports:

- Unique packet IDs
- Duplicate detection
- Multi-hop routing
- Time-To-Live (TTL)
- Automatic acknowledgements
- Relay decisions

---

# 📈 Development Progress

| Phase | Status |
|-------|:------:|
| Core Android Application | ✅ |
| BLE Discovery | ✅ |
| Friend Management | ✅ |
| Offline Mapping | ✅ |
| Bluetooth GATT Transport | ✅ |
| Chunked Payload Transport | ✅ |
| Dynamic Mesh Topology | ✅ |
| Multi-Hop Routing | ✅ |
| Adaptive Route Selection | ✅ |
| Store-and-Forward Networking | ✅ |
| Friend Location Propagation | ✅ |
| Mesh Diagnostics | ✅ |
| Flight Recorder | ✅ |
| User Profiles | ✅ |
| Live Friend Dashboard | ✅ |
| Multi-Device Testing | ✅ |
| Google Play Alpha | 🚧 |

---

# 🚀 Roadmap

## Alpha

- [x] Bluetooth mesh networking
- [x] Offline friend tracking
- [x] Friend profiles
- [x] Store-and-forward networking
- [x] Live diagnostics
- [ ] Large-scale festival testing

---

## Beta

- [ ] End-to-end encryption
- [ ] Offline messaging
- [ ] Group support
- [ ] Friend requests over mesh
- [ ] Emergency broadcast mode
- [ ] Battery optimisation

---

## Future

- [ ] Smarter routing algorithms
- [ ] Cross-platform support
- [ ] Mesh analytics
- [ ] Delay-tolerant networking improvements

---

# 💻 Technology

- React Native
- TypeScript
- Bluetooth Low Energy (BLE)
- Bluetooth GATT
- MapLibre
- Android

---

# 🌍 Long-Term Vision

Imagine thousands of people at a music festival.

```text
🙂────🙂────🙂
│           │
🙂────🙂────🙂
      │
      ⭐
```

Two friends may never come within Bluetooth range of one another.

Instead, every nearby Offlink user becomes part of a decentralised relay network, passing information from phone to phone until it eventually reaches its destination.

The more people running Offlink, the stronger the network becomes.

No internet.

No servers.

No mobile signal.

Just people carrying information for one another.

---

<div align="center">

## ⭐ Help Shape Offlink

Offlink has now reached its **Alpha** milestone and is entering wider real-world testing.

Feedback, bug reports and feature suggestions are always welcome.

If you find the project interesting, consider giving the repository a ⭐.

</div>
