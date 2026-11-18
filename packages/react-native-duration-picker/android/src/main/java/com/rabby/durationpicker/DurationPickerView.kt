package com.rabby.durationpicker

import android.content.res.Configuration
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.NumberPicker
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event

class DurationPickerView(private val reactContext: ThemedReactContext) : LinearLayout(reactContext) {
  private var hours: NumberPicker? = null
  private var minutes: NumberPicker? = null
  private var session = 0
  private var value = 0
  private var dark = false
  private var pickerEnabled = true
  private var updating = false
  private var hoursIdle = true
  private var minutesIdle = true
  private var pendingRead: Int? = null

  init {
    orientation = HORIZONTAL
    gravity = Gravity.CENTER
    createPickers()
  }

  private fun createPickers() {
    hours?.setOnValueChangedListener(null)
    minutes?.setOnValueChangedListener(null)
    hours?.setOnScrollListener(null)
    minutes?.setOnScrollListener(null)
    removeAllViews()
    val config = Configuration(resources.configuration)
    config.uiMode = (config.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
      if (dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
    val context = ContextThemeWrapper(reactContext.createConfigurationContext(config),
      if (dark) android.R.style.Theme_Material else android.R.style.Theme_Material_Light)
    fun picker(maximum: Int, isHours: Boolean): NumberPicker = NumberPicker(context).apply {
      minValue = 0
      maxValue = maximum
      wrapSelectorWheel = false
      descendantFocusability = FOCUS_BLOCK_DESCENDANTS
      setFormatter { it.toString().padStart(2, '0') }
      setOnValueChangedListener { _, _, _ ->
        if (!updating) {
          this@DurationPickerView.value = currentMinutes()
          emit("topDurationChange")
        }
      }
      setOnScrollListener { _, state ->
        if (isHours) hoursIdle = state == NumberPicker.OnScrollListener.SCROLL_STATE_IDLE
        else minutesIdle = state == NumberPicker.OnScrollListener.SCROLL_STATE_IDLE
        finishReadIfIdle()
      }
      setOnTouchListener { _, event ->
        parent?.requestDisallowInterceptTouchEvent(event.actionMasked != android.view.MotionEvent.ACTION_UP &&
          event.actionMasked != android.view.MotionEvent.ACTION_CANCEL)
        false
      }
      isEnabled = pickerEnabled
    }
    hours = picker(23, true)
    minutes = picker(59, false)
    hours?.contentDescription = "h"
    minutes?.contentDescription = "min"
    fun unit(text: String) = TextView(context).apply {
      this.text = text
      textSize = 18f
      importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    addView(hours, LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
    addView(unit("h"), LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
    addView(minutes, LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
    addView(unit("min"), LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
    hoursIdle = true
    minutesIdle = true
    applyMinutes(value)
  }

  fun setMinutes(next: Int) {
    val normalized = next.coerceIn(0, 1439)
    if (normalized == currentMinutes()) { value = normalized; return }
    applyMinutes(normalized)
  }
  private fun applyMinutes(next: Int) {
    value = next.coerceIn(0, 1439)
    updating = true
    hours?.value = value / 60
    minutes?.value = value % 60
    updating = false
  }
  fun setSession(next: Int) {
    if (session == next) return
    pendingRead = null
    session = next
    createPickers()
  }
  fun setDarkTheme(next: Boolean) { if (dark != next) { dark = next; createPickers() } }
  fun setPickerEnabled(next: Boolean) { pickerEnabled = next; hours?.isEnabled = next; minutes?.isEnabled = next }
  private fun currentMinutes() = (hours?.value ?: 0) * 60 + (minutes?.value ?: 0)

  fun readCurrentValue(requestId: Int) {
    pendingRead = requestId
    finishReadIfIdle()
  }
  private fun finishReadIfIdle() {
    if (!hoursIdle || !minutesIdle) return
    val requestId = pendingRead ?: return
    pendingRead = null
    emit("topValueRead", requestId)
  }
  private fun emit(name: String, requestId: Int? = null) {
    val payload = Arguments.createMap().apply {
      putInt("minutes", currentMinutes())
      putInt("sessionId", session)
      requestId?.let { putInt("requestId", it) }
    }
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
      DurationEvent(UIManagerHelper.getSurfaceId(this), id, name, payload)
    )
  }
  override fun onDetachedFromWindow() { pendingRead = null; super.onDetachedFromWindow() }
}

private class DurationEvent(surfaceId: Int, viewId: Int, private val name: String,
  private val payload: WritableMap) : Event<DurationEvent>(surfaceId, viewId) {
  override fun getEventName() = name
  override fun canCoalesce() = false
  override fun getEventData() = payload
}
