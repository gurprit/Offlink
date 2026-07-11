package com.offlink.gatt

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.nio.charset.StandardCharsets
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.ceil

class OfflinkGattModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    val SERVICE_UUID: UUID =
      UUID.fromString("0000feed-0000-1000-8000-00805f9b34fb")

    val TOPOLOGY_CHARACTERISTIC_UUID: UUID =
      UUID.fromString("0000beef-0000-1000-8000-00805f9b34fb")

    val TRANSPORT_META_CHARACTERISTIC_UUID: UUID =
      UUID.fromString("0000cafe-0000-1000-8000-00805f9b34fb")

    val TRANSPORT_CONTROL_CHARACTERISTIC_UUID: UUID =
      UUID.fromString("0000caf1-0000-1000-8000-00805f9b34fb")

    val TRANSPORT_CHUNK_CHARACTERISTIC_UUID: UUID =
      UUID.fromString("0000caf2-0000-1000-8000-00805f9b34fb")

    val INBOUND_TOPOLOGY_CHARACTERISTIC_UUID: UUID =
      UUID.fromString("0000caf3-0000-1000-8000-00805f9b34fb")

    const val TRANSPORT_CHUNK_SIZE = 384
  }

  private var gattServer: BluetoothGattServer? = null
  private var topologyPayload: String = "Hello from Offlink GATT"
  private var transportPayload: String = ""

  private val requestedChunkByDevice =
    ConcurrentHashMap<String, Int>()

  private val transportSnapshotByDevice =
    ConcurrentHashMap<String, String>()

  private val inboundTopologyChunksByTransfer =
    ConcurrentHashMap<String, MutableMap<Int, String>>()

  private val inboundTopologyChunkCounts =
    ConcurrentHashMap<String, Int>()

  @Volatile
  private var pendingInboundTopology: String? = null

  override fun getName(): String = "OfflinkGatt"

  private fun hasBluetoothConnectPermission(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      ContextCompat.checkSelfPermission(
        reactContext,
        Manifest.permission.BLUETOOTH_CONNECT
      ) == PackageManager.PERMISSION_GRANTED
  }

  private fun encodedTransportPayload(): String {
    if (transportPayload.isEmpty()) {
      return ""
    }

    return Base64.encodeToString(
      transportPayload.toByteArray(StandardCharsets.UTF_8),
      Base64.NO_WRAP
    )
  }

  private fun transportChunkCount(encoded: String): Int {
    if (encoded.isEmpty()) {
      return 0
    }

    return ceil(
      encoded.length.toDouble() / TRANSPORT_CHUNK_SIZE.toDouble()
    ).toInt()
  }

  private fun transportMetadata(
    deviceKey: String
  ): String {
    val encoded = encodedTransportPayload()

    transportSnapshotByDevice[deviceKey] = encoded
    requestedChunkByDevice[deviceKey] = 0

    val chunkCount = transportChunkCount(encoded)

    return "OLTX|1|$chunkCount|${encoded.length}"
  }

  private fun transportChunk(
    deviceKey: String,
    index: Int
  ): String {
    val encoded =
      transportSnapshotByDevice[deviceKey]
        ?: encodedTransportPayload()

    val chunkCount = transportChunkCount(encoded)

    if (index < 0 || index >= chunkCount) {
      return ""
    }

    val start = index * TRANSPORT_CHUNK_SIZE
    val end = minOf(start + TRANSPORT_CHUNK_SIZE, encoded.length)

    return encoded.substring(start, end)
  }

  private fun acceptInboundTopologyChunk(
    device: BluetoothDevice?,
    value: ByteArray?
  ): Boolean {
    val frame =
      value
        ?.toString(StandardCharsets.UTF_8)
        ?.trim()
        ?: return false

    val parts = frame.split("|", limit = 6)

    if (
      parts.size != 6 ||
      parts[0] != "OLUP" ||
      parts[1] != "1" ||
      parts[2].isBlank()
    ) {
      return false
    }

    val transferId = parts[2]
    val chunkIndex = parts[3].toIntOrNull() ?: return false
    val chunkCount = parts[4].toIntOrNull() ?: return false
    val chunk = parts[5]

    if (
      chunkIndex < 0 ||
      chunkCount <= 0 ||
      chunkIndex >= chunkCount ||
      chunkCount > 64
    ) {
      return false
    }

    val deviceKey = device?.address ?: "unknown"
    val transferKey = "$deviceKey:$transferId"

    val chunks =
      inboundTopologyChunksByTransfer.getOrPut(transferKey) {
        ConcurrentHashMap<Int, String>()
      }

    inboundTopologyChunkCounts[transferKey] = chunkCount
    chunks[chunkIndex] = chunk

    if (chunks.size != chunkCount) {
      return true
    }

    val encoded = buildString {
      for (index in 0 until chunkCount) {
        val nextChunk = chunks[index] ?: return false
        append(nextChunk)
      }
    }

    return try {
      val decodedBytes = Base64.decode(encoded, Base64.NO_WRAP)

      pendingInboundTopology =
        decodedBytes.toString(StandardCharsets.UTF_8)

      inboundTopologyChunksByTransfer.remove(transferKey)
      inboundTopologyChunkCounts.remove(transferKey)

      true
    } catch (_: IllegalArgumentException) {
      inboundTopologyChunksByTransfer.remove(transferKey)
      inboundTopologyChunkCounts.remove(transferKey)
      false
    }
  }

  private fun sendReadResponse(
    device: BluetoothDevice?,
    requestId: Int,
    offset: Int,
    value: String
  ) {
    val bytes = value.toByteArray(StandardCharsets.UTF_8)

    val response =
      if (offset < bytes.size) {
        bytes.copyOfRange(offset, bytes.size)
      } else {
        ByteArray(0)
      }

    gattServer?.sendResponse(
      device,
      requestId,
      BluetoothGatt.GATT_SUCCESS,
      offset,
      response
    )
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun startServer(nextPayload: String, promise: Promise) {
    if (!hasBluetoothConnectPermission()) {
      promise.reject(
        "OFFLINK_GATT_PERMISSION",
        "Bluetooth connect permission not granted."
      )
      return
    }

    topologyPayload =
      if (nextPayload.isBlank()) {
        "Hello from Offlink GATT"
      } else {
        nextPayload
      }

    val bluetoothManager =
      reactContext.getSystemService(
        Context.BLUETOOTH_SERVICE
      ) as BluetoothManager

    gattServer?.close()

    gattServer = bluetoothManager.openGattServer(
      reactContext,
      object : BluetoothGattServerCallback() {
        override fun onCharacteristicReadRequest(
          device: BluetoothDevice?,
          requestId: Int,
          offset: Int,
          characteristic: BluetoothGattCharacteristic?
        ) {
          when (characteristic?.uuid) {
            TOPOLOGY_CHARACTERISTIC_UUID -> {
              sendReadResponse(
                device,
                requestId,
                offset,
                topologyPayload
              )
            }

            TRANSPORT_META_CHARACTERISTIC_UUID -> {
              val deviceKey = device?.address ?: "unknown"

              sendReadResponse(
                device,
                requestId,
                offset,
                transportMetadata(deviceKey)
              )
            }

            TRANSPORT_CHUNK_CHARACTERISTIC_UUID -> {
              val deviceKey = device?.address ?: "unknown"
              val requestedIndex =
                requestedChunkByDevice[deviceKey] ?: 0

              sendReadResponse(
                device,
                requestId,
                offset,
                transportChunk(
                  deviceKey,
                  requestedIndex
                )
              )
            }

            else -> {
              gattServer?.sendResponse(
                device,
                requestId,
                BluetoothGatt.GATT_FAILURE,
                offset,
                null
              )
            }
          }
        }

        override fun onCharacteristicWriteRequest(
          device: BluetoothDevice?,
          requestId: Int,
          characteristic: BluetoothGattCharacteristic?,
          preparedWrite: Boolean,
          responseNeeded: Boolean,
          offset: Int,
          value: ByteArray?
        ) {
          val success =
            when (characteristic?.uuid) {
              TRANSPORT_CONTROL_CHARACTERISTIC_UUID -> {
                val requestedIndex =
                  value
                    ?.toString(StandardCharsets.UTF_8)
                    ?.trim()
                    ?.toIntOrNull()

                if (requestedIndex == null || requestedIndex < 0) {
                  false
                } else {
                  val deviceKey = device?.address ?: "unknown"
                  requestedChunkByDevice[deviceKey] = requestedIndex
                  true
                }
              }

              INBOUND_TOPOLOGY_CHARACTERISTIC_UUID -> {
                acceptInboundTopologyChunk(device, value)
              }

              else -> false
            }

          if (responseNeeded) {
            gattServer?.sendResponse(
              device,
              requestId,
              if (success) {
                BluetoothGatt.GATT_SUCCESS
              } else {
                BluetoothGatt.GATT_FAILURE
              },
              offset,
              value
            )
          }
        }
      }
    )

    if (gattServer == null) {
      promise.reject(
        "OFFLINK_GATT_START_FAILED",
        "Could not start GATT server."
      )
      return
    }

    val service = BluetoothGattService(
      SERVICE_UUID,
      BluetoothGattService.SERVICE_TYPE_PRIMARY
    )

    val topologyCharacteristic =
      BluetoothGattCharacteristic(
        TOPOLOGY_CHARACTERISTIC_UUID,
        BluetoothGattCharacteristic.PROPERTY_READ,
        BluetoothGattCharacteristic.PERMISSION_READ
      )

    val transportMetaCharacteristic =
      BluetoothGattCharacteristic(
        TRANSPORT_META_CHARACTERISTIC_UUID,
        BluetoothGattCharacteristic.PROPERTY_READ,
        BluetoothGattCharacteristic.PERMISSION_READ
      )

    val transportControlCharacteristic =
      BluetoothGattCharacteristic(
        TRANSPORT_CONTROL_CHARACTERISTIC_UUID,
        BluetoothGattCharacteristic.PROPERTY_WRITE,
        BluetoothGattCharacteristic.PERMISSION_WRITE
      )

    val transportChunkCharacteristic =
      BluetoothGattCharacteristic(
        TRANSPORT_CHUNK_CHARACTERISTIC_UUID,
        BluetoothGattCharacteristic.PROPERTY_READ,
        BluetoothGattCharacteristic.PERMISSION_READ
      )

    val inboundTopologyCharacteristic =
      BluetoothGattCharacteristic(
        INBOUND_TOPOLOGY_CHARACTERISTIC_UUID,
        BluetoothGattCharacteristic.PROPERTY_WRITE,
        BluetoothGattCharacteristic.PERMISSION_WRITE
      )

    service.addCharacteristic(topologyCharacteristic)
    service.addCharacteristic(transportMetaCharacteristic)
    service.addCharacteristic(transportControlCharacteristic)
    service.addCharacteristic(transportChunkCharacteristic)
    service.addCharacteristic(inboundTopologyCharacteristic)

    val added = gattServer?.addService(service) ?: false

    if (added) {
      promise.resolve(true)
    } else {
      promise.reject(
        "OFFLINK_GATT_SERVICE_FAILED",
        "Could not add GATT service."
      )
    }
  }

  @ReactMethod
  fun setPayload(nextPayload: String, promise: Promise) {
    topologyPayload =
      if (nextPayload.isBlank()) {
        "Hello from Offlink GATT"
      } else {
        nextPayload
      }

    promise.resolve(true)
  }

  @ReactMethod
  fun setTransportPayload(
    nextPayload: String,
    promise: Promise
  ) {
    transportPayload = nextPayload
    promise.resolve(true)
  }

  @ReactMethod
  fun consumeInboundTopology(promise: Promise) {
    val value = pendingInboundTopology
    pendingInboundTopology = null
    promise.resolve(value)
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun stopServer(promise: Promise) {
    if (!hasBluetoothConnectPermission()) {
      promise.reject(
        "OFFLINK_GATT_PERMISSION",
        "Bluetooth connect permission not granted."
      )
      return
    }

    gattServer?.close()
    gattServer = null
    requestedChunkByDevice.clear()
    transportSnapshotByDevice.clear()
    inboundTopologyChunksByTransfer.clear()
    inboundTopologyChunkCounts.clear()
    pendingInboundTopology = null

    promise.resolve(true)
  }
}
