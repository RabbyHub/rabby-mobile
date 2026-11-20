package com.rabby.durationpicker

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.icu.text.MeasureFormat
import android.icu.util.MeasureUnit
import android.widget.LinearLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import java.util.Locale

class DurationPickerView(private val reactContext: ThemedReactContext) : LinearLayout(reactContext) {
  var durationMinutes = 0
  var minimumDurationMinutes = 0
  var sessionId = 0
  private var activeSession: Int? = null
  private var appliedMinimum = 0
  private var pendingRead: Int? = null
  private val divider = Paint()
  private val hours = DurationWheel(reactContext, 23, MeasureUnit.HOUR, MeasureFormat.FormatWidth.WIDE)
  private val minutes = DurationWheel(reactContext, 59, MeasureUnit.MINUTE, MeasureFormat.FormatWidth.SHORT)
  private val finishRead = Runnable(::readWhenSettled)

  init {
    orientation = HORIZONTAL
    for (wheel in listOf(hours, minutes)) {
      addView(wheel, LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
    }
    hours.onSelectionChange = {
      updateMinuteMinimum()
      emit("topDurationChange")
    }
    minutes.onSelectionChange = { emit("topDurationChange") }
    setDarkTheme(false)
  }

  // Fabric may deliver the two props in either order. Subsequent values in the
  // same session are JS echoes of previews and can lag behind a native fling.
  fun applySession() {
    val minimum = minimumDurationMinutes.coerceIn(0, 1439)
    if (sessionId == activeSession && minimum == appliedMinimum) return
    val initial = (if (sessionId == activeSession) hours.selected * 60 + minutes.selected
      else durationMinutes).coerceIn(minimum, 1439)
    pendingRead = null
    activeSession = sessionId
    appliedMinimum = minimum
    hours.setMinimum(minimum / 60)
    hours.select(initial / 60)
    updateMinuteMinimum()
    minutes.select(initial % 60)
  }

  private fun updateMinuteMinimum() {
    minutes.setMinimum(if (hours.selected == appliedMinimum / 60) appliedMinimum % 60 else 0)
  }

  fun setLocale(tag: String?) {
    val locale = if (tag.isNullOrBlank()) resources.configuration.locales[0] else Locale.forLanguageTag(tag)
    hours.setLabelLocale(locale)
    minutes.setLabelLocale(locale)
  }

  fun setMinuteLabels(labels: List<String>?) = minutes.setCustomLabels(labels)

  fun setDarkTheme(dark: Boolean) {
    val textColor = if (dark) Color.WHITE else Color.BLACK
    hours.setLabelColor(textColor)
    minutes.setLabelColor(textColor)
    divider.color = if (dark) 0x20FFFFFF else 0x0A000000
    invalidate()
  }

  override fun dispatchDraw(canvas: Canvas) {
    super.dispatchDraw(canvas)
    val top = hours.paddingTop.toFloat()
    val bottom = height - hours.paddingBottom.toFloat()
    canvas.drawRect(0f, top, width.toFloat(), top + 1f, divider)
    canvas.drawRect(0f, bottom - 1f, width.toFloat(), bottom, divider)
  }

  fun setPickerEnabled(enabled: Boolean) {
    hours.isEnabled = enabled
    minutes.isEnabled = enabled
  }

  fun readCurrentValue(requestId: Int) {
    pendingRead = requestId
    removeCallbacks(finishRead)
    readWhenSettled()
  }

  // SnapHelper can already own a fling before RecyclerView enters SETTLING.
  // Check only while a Confirm is pending, including that first animation frame.
  private fun readWhenSettled() {
    val request = pendingRead ?: return
    if (hours.isSettled && minutes.isSettled) {
      pendingRead = null
      emit("topValueRead", request)
    } else {
      postOnAnimation(finishRead)
    }
  }

  private fun emit(name: String, requestId: Int? = null) {
    val session = activeSession ?: return
    val payload = Arguments.createMap().apply {
      putInt("minutes", hours.selected * 60 + minutes.selected)
      putInt("sessionId", session)
      requestId?.let { putInt("requestId", it) }
    }
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(
      DurationEvent(UIManagerHelper.getSurfaceId(this), id, name, payload)
    )
  }

  // Fabric owns the outer frame. RecyclerView also needs Android layout passes
  // after an imperative reset or a locale change within that same frame.
  private val layoutWheels = Runnable {
    if (isLayoutRequested && width > 0 && height > 0) {
      measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
      layout(left, top, right, bottom)
    }
  }

  override fun requestLayout() {
    super.requestLayout()
    if (isAttachedToWindow && !isInLayout) {
      removeCallbacks(layoutWheels)
      postOnAnimation(layoutWheels)
    }
  }

  override fun onDetachedFromWindow() {
    pendingRead = null
    removeCallbacks(finishRead)
    removeCallbacks(layoutWheels)
    super.onDetachedFromWindow()
  }
}

private class DurationEvent(surfaceId: Int, viewId: Int, private val name: String,
  private val payload: WritableMap) : Event<DurationEvent>(surfaceId, viewId) {
  override fun getEventName() = name
  override fun canCoalesce() = false
  override fun getEventData() = payload
}
