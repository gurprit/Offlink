package com.offlink.heading

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.roundToInt

class OfflinkHeadingModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), SensorEventListener {

  private val sensorManager =
    reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val rotationVectorSensor =
    sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)

  private var started = false
  private var lastHeading = Float.NaN
  private var listenerCount = 0

  override fun getName(): String = "OfflinkHeading"

  @ReactMethod
  fun start() {
    if (started || rotationVectorSensor == null) {
      return
    }

    started = sensorManager.registerListener(
      this,
      rotationVectorSensor,
      SensorManager.SENSOR_DELAY_GAME,
    )
  }

  @ReactMethod
  fun stop() {
    if (!started) {
      return
    }

    sensorManager.unregisterListener(this)
    started = false
    lastHeading = Float.NaN
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
    if (listenerCount == 0) {
      stop()
    }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.sensor?.type != Sensor.TYPE_ROTATION_VECTOR || listenerCount <= 0) {
      return
    }

    val rotationMatrix = FloatArray(9)
    val orientation = FloatArray(3)
    SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
    SensorManager.getOrientation(rotationMatrix, orientation)

    var heading = Math.toDegrees(orientation[0].toDouble()).toFloat()
    if (heading < 0f) {
      heading += 360f
    }

    if (!lastHeading.isNaN()) {
      var delta = heading - lastHeading
      if (delta > 180f) delta -= 360f
      if (delta < -180f) delta += 360f
      heading = (lastHeading + delta * 0.18f + 360f) % 360f
    }

    lastHeading = heading

    val payload = Arguments.createMap().apply {
      putDouble("heading", heading.toDouble())
      putInt("accuracy", event.accuracy)
    }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("offlinkHeadingChanged", payload)
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
