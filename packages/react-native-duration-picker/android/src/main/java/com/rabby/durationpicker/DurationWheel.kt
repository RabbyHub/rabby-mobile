package com.rabby.durationpicker

import android.content.Context
import android.graphics.Color
import android.icu.text.MeasureFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.LinearSnapHelper
import androidx.recyclerview.widget.RecyclerView
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/** One native, finite column of the TWAP duration picker. */
internal class DurationWheel(
  context: Context,
  private val maximum: Int,
  private val unit: MeasureUnit,
  private val formatWidth: MeasureFormat.FormatWidth
) : RecyclerView(context) {
  var selected = 0
    private set
  var onSelectionChange: () -> Unit = {}
  val isSettled: Boolean
    get() = scrollState == SCROLL_STATE_IDLE && !rows.isSmoothScrolling

  private var rowHeight = 1
  private var positioning = false
  private var labelColor = Color.BLACK
  private var labelLocale = resources.configuration.locales[0]
  private var customLabels: List<String>? = null
  private var labels = formatLabels(labelLocale)
  private val snap = LinearSnapHelper()
  private val rows = object : LinearLayoutManager(context) {
    override fun calculateExtraLayoutSpace(state: State, extraLayoutSpace: IntArray) {
      // Rows outside the flat viewport can still be visible on the curved wheel.
      extraLayoutSpace[0] = rowHeight * 3
      extraLayoutSpace[1] = rowHeight * 3
    }
  }

  init {
    layoutManager = rows
    adapter = LabelAdapter()
    itemAnimator = null
    clipToPadding = false
    isVerticalScrollBarEnabled = false
    overScrollMode = OVER_SCROLL_NEVER
    isFocusable = true
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    contentDescription = labels[selected]
    snap.attachToRecyclerView(this)
    addOnScrollListener(object : OnScrollListener() {
      override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) = updateRows()
    })
  }

  private fun formatLabels(locale: Locale): List<String> {
    val format = MeasureFormat.getInstance(locale, formatWidth)
    return (0..maximum).map { format.formatMeasures(Measure(it, unit)) }
  }

  fun setLabelLocale(locale: Locale) {
    if (labelLocale == locale) return
    labelLocale = locale
    if (customLabels == null) updateLabels()
  }

  fun setCustomLabels(value: List<String>?) {
    val valid = value?.takeIf { it.size == maximum + 1 }
    if (customLabels == valid) return
    customLabels = valid
    updateLabels()
  }

  private fun updateLabels() {
    labels = customLabels ?: formatLabels(labelLocale)
    contentDescription = labels[selected]
    adapter?.notifyDataSetChanged()
  }

  fun setLabelColor(color: Int) {
    if (labelColor == color) return
    labelColor = color
    adapter?.notifyDataSetChanged()
  }

  override fun onMeasure(widthSpec: Int, heightSpec: Int) {
    val height = MeasureSpec.getSize(heightSpec)
    if (height > 0) {
      // Figma's 393 × 138 wheel has its selection between y=78 and y=120.
      val top = (height * (78f / 138f)).roundToInt()
      val bottom = (height * (18f / 138f)).roundToInt()
      if (paddingTop != top || paddingBottom != bottom) {
        rowHeight = (height - top - bottom).coerceAtLeast(1)
        setPadding(0, top, 0, bottom)
        adapter?.notifyDataSetChanged()
        select(selected)
      }
    }
    super.onMeasure(widthSpec, heightSpec)
  }

  fun select(value: Int) {
    positioning = true
    selected = value
    contentDescription = labels[value]
    stopScroll()
    rows.scrollToPositionWithOffset(value, 0)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    positioning = false
    updateRows()
  }

  private fun updateRows() {
    val center = paddingTop + rowHeight / 2f
    val sheetCenter = (parent as? ViewGroup)?.width?.div(2f) ?: (left + width / 2f)
    val towardCenter = sheetCenter - (left + width / 2f)
    for (index in 0 until childCount) {
      val row = getChildAt(index)
      val distance = (row.top + row.height / 2f - center) / rowHeight
      val depth = abs(distance)
      // Project the linear rows onto a cylinder. Recycling, scrolling and
      // snapping continue to use the original, equally spaced row positions.
      val angle = distance * 0.5
      if (abs(angle) >= PI / 2) {
        row.alpha = 0f
      } else {
        // The distant labels in the design also recede towards the sheet centre.
        row.translationX = towardCenter * 0.22f * depth / (1 + depth)
        row.translationY = ((sin(angle) * 2 - distance) * rowHeight).toFloat()
        row.scaleY = cos(angle).toFloat()
        row.alpha = 1f / (1f + 2f * depth)
      }
    }
    if (positioning) return
    val row = snap.findSnapView(rows) ?: return
    val position = getChildAdapterPosition(row)
    if (position != NO_POSITION && position != selected) {
      selected = position
      contentDescription = labels[position]
      onSelectionChange()
    }
  }

  private fun choose(value: Int) {
    if (!isEnabled || value !in 0..maximum || value == selected) return
    select(value)
    onSelectionChange()
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (!isEnabled) return false
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> parent?.requestDisallowInterceptTouchEvent(true)
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> parent?.requestDisallowInterceptTouchEvent(false)
    }
    return super.dispatchTouchEvent(event)
  }

  override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
    super.onInitializeAccessibilityNodeInfo(info)
    info.className = "android.widget.SeekBar"
    info.rangeInfo = AccessibilityNodeInfo.RangeInfo.obtain(
      AccessibilityNodeInfo.RangeInfo.RANGE_TYPE_INT, 0f, maximum.toFloat(), selected.toFloat())
    if (isEnabled && selected < maximum) info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)
    if (isEnabled && selected > 0) info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD)
  }

  override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
    val target = when (action) {
      AccessibilityNodeInfo.ACTION_SCROLL_FORWARD -> selected + 1
      AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD -> selected - 1
      else -> return super.performAccessibilityAction(action, arguments)
    }
    if (!isEnabled || target !in 0..maximum) return false
    choose(target)
    return true
  }

  private class LabelHolder(val label: TextView) : ViewHolder(label)

  private inner class LabelAdapter : Adapter<LabelHolder>() {
    override fun getItemCount() = labels.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LabelHolder {
      val label = TextView(context).apply {
        gravity = Gravity.CENTER
        includeFontPadding = false
        maxLines = 1
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, rowHeight)
      }
      val holder = LabelHolder(label)
      label.setOnClickListener { if (label.alpha > 0) choose(holder.bindingAdapterPosition) }
      return holder
    }

    override fun onBindViewHolder(holder: LabelHolder, position: Int) {
      holder.label.apply {
        layoutParams.height = rowHeight
        setTextSize(TypedValue.COMPLEX_UNIT_PX, rowHeight * 0.475f)
        setTextColor(labelColor)
        text = labels[position]
      }
    }
  }
}
