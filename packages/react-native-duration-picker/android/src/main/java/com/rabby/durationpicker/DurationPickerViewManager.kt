package com.rabby.durationpicker

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.RabbyDurationPickerManagerDelegate
import com.facebook.react.viewmanagers.RabbyDurationPickerManagerInterface

class DurationPickerViewManager : SimpleViewManager<DurationPickerView>(), RabbyDurationPickerManagerInterface<DurationPickerView> {
  private val delegate = RabbyDurationPickerManagerDelegate(this)
  override fun getDelegate(): ViewManagerDelegate<DurationPickerView> = delegate
  override fun getName() = "RabbyDurationPicker"
  override fun createViewInstance(context: ThemedReactContext) = DurationPickerView(context)
  override fun setDurationMinutes(view: DurationPickerView, value: Int) { view.durationMinutes = value }
  override fun setMinuteLabels(view: DurationPickerView, value: ReadableArray?) {
    view.setMinuteLabels(value?.let { labels -> List(labels.size()) { labels.getString(it).orEmpty() } })
  }
  override fun setSessionId(view: DurationPickerView, value: Int) { view.sessionId = value }
  override fun setAndroidLocale(view: DurationPickerView, value: String?) = view.setLocale(value)
  override fun onAfterUpdateTransaction(view: DurationPickerView) {
    super.onAfterUpdateTransaction(view)
    view.applySession()
  }
  override fun setDark(view: DurationPickerView, value: Boolean) = view.setDarkTheme(value)
  override fun setEnabled(view: DurationPickerView, value: Boolean) = view.setPickerEnabled(value)
  override fun readCurrentValue(view: DurationPickerView, requestId: Int) = view.readCurrentValue(requestId)
  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> = mutableMapOf(
    "topDurationChange" to mapOf("registrationName" to "onDurationChange"),
    "topValueRead" to mapOf("registrationName" to "onValueRead")
  )
}
