package com.workoutpro.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/** Tile: current exercise / set (or "open a workout on the phone"); tap opens the app. */
class WorkoutTileService : TileService() {

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val state = WorkoutRepository.state.value ?: WorkoutRepository.loadCached(this)
        val now = System.currentTimeMillis()
        val lines = tileLines(state, now)

        val column = LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(text(lines.first, 13f, ACCENT, bold = true))
            .addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(4f)).build())
            .addContent(text(lines.second, 18f, WHITE, bold = true, maxLines = 2))
            .apply {
                lines.third?.let {
                    addContent(LayoutElementBuilders.Spacer.Builder().setHeight(dp(4f)).build())
                    addContent(text(it, 15f, MUTED))
                }
            }
            .build()

        val open = ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName(MainActivity::class.java.name)
                            .build()
                    )
                    .build()
            )
            .build()

        val root = LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(open).build())
            .addContent(column)
            .build()

        val resting = state?.isResting(now) == true
        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            // Rest is shown as an end time; refresh once it is over. Otherwise phone updates push new tiles.
            .setFreshnessIntervalMillis(if (resting) (state!!.restEndAt!! - now).coerceAtLeast(5_000) else 0)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())

    private fun tileLines(state: WorkoutState?, now: Long): Triple<String, String, String?> {
        if (state == null || !state.active) {
            return Triple(getString(R.string.app_name), getString(R.string.idle_title), getString(R.string.tile_tap_to_open))
        }
        if (state.isResting(now)) {
            val end = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.ROOT).format(java.util.Date(state.restEndAt!!))
            val next = if (state.allDone) getString(R.string.all_done) else "${state.exerciseName} · ${state.setIndex + 1}/${state.setCount}"
            return Triple(state.workoutName, getString(R.string.tile_rest_until, end), next)
        }
        if (state.allDone) return Triple(state.workoutName, getString(R.string.all_done), getString(R.string.finish_hint))
        return Triple(
            state.workoutName,
            "${state.exerciseName} · ${state.setIndex + 1}/${state.setCount}",
            "${formatWeight(state.targetWeight)} kg × ${state.targetReps}",
        )
    }

    private fun text(value: String, size: Float, color: Int, bold: Boolean = false, maxLines: Int = 1) =
        LayoutElementBuilders.Text.Builder()
            .setText(value)
            .setMaxLines(maxLines)
            .setFontStyle(
                LayoutElementBuilders.FontStyle.Builder()
                    .setSize(sp(size))
                    .setColor(argb(color))
                    .setWeight(if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL)
                    .build()
            )
            .build()

    companion object {
        private const val RESOURCES_VERSION = "1"
        private const val WHITE = 0xFFFFFFFF.toInt()
        private const val MUTED = 0xFFB0B0B5.toInt()
        private const val ACCENT = 0xFF34C77B.toInt()
    }
}
