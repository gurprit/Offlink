package com.offlink.gatt

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.nio.charset.Charset
import java.util.UUID

class OfflinkGattModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    val SERVICE_UUID: UUID = UUID.fromString("0000feed-0000-1000-8000-00805f9b34fb")
    val MESH_CHARACTERISTIC_UUID: UUID = UUID.fromString("0000beef-0000-1000-8000-00805f9b34fb")
  }

  private var gattServer: BluetoothGattServer? = null
  private var payload: String = "Hello from Offlink GATT"

  override fun getName(): String = "OfflinkGatt"

  private fun hasBluetoothConnectPermission(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      ContextCompat.checkSelfPermission(
        reactContext,
        Manifest.permission.BLUETOOTH_CONNECT
      ) == PackageManager.PERMISSION_GRANTED
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun startServer(nextPayload: String, promise: Promise) {
    if (!hasBluetoothConnectPermission()) {
      promise.reject("OFFLINK_GATT_PERMISSION", "Bluetooth connect permission not granted.")
      return
    }

    payload = if (nextPayload.isBlank()) "Hello from Offlink GATT" else nextPayload

    val bluetoothManager =
      reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

    gattServer?.close()
    gattServer = bluetoothManager.openGattServer(
      reactContext,
      object : BluetoothGattServerCallback() {
        override fun onCharacteristicReadRequest(
          device: android.bluetooth.BluetoothDevice?,
          requestId: Int,
          offset: Int,
          characteristic: BluetoothGattCharacteristic?
        ) {
          if (characteristic?.uuid != MESH_CHARACTERISTIC_UUID) {
            gattServer?.sendResponse(
              device,
              requestId,
              BluetoothGatt.GATT_FAILURE,
              offset,
              null
            )
            return
          }

          val bytes = payload.toByteArray(Charset.forName("UTF-8"))
          val value = if (offset < bytes.size) bytes.copyOfRange(offset, bytes.size) else ByteArray(0)

          gattServer?.sendResponse(
            device,
            requestId,
            BluetoothGatt.GATT_SUCCESS,
            offset,
            value
          )
        }
      }
    )

    if (gattServer == null) {
      promise.reject("OFFLINK_GATT_START_FAILED", "Could not start GATT server.")
      return
    }

    val service = BluetoothGattService(
      SERVICE_UUID,
      BluetoothGattService.SERVICE_TYPE_PRIMARY
    )

    val characteristic = BluetoothGattCharacteristic(
      MESH_CHARACTERISTIC_UUID,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ
    )

    service.addCharacteristic(characteristic)

    val added = gattServer?.addService(service) ?: false

    if (added) {
      promise.resolve(true)
    } else {
      promise.reject("OFFLINK_GATT_SERVICE_FAILED", "Could not add GATT service.")
    }
  }

  @ReactMethod
  fun setPayload(nextPayload: String, promise: Promise) {
    payload = if (nextPayload.isBlank()) "Hello from Offlink GATT" else nextPayload
    promise.resolve(true)
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun stopServer(promise: Promise) {
    if (!hasBluetoothConnectPermission()) {
      promise.reject("OFFLINK_GATT_PERMISSION", "Bluetooth connect permission not granted.")
      return
    }

    gattServer?.close()
    gattServer = null
    promise.resolve(true)
  }
}
