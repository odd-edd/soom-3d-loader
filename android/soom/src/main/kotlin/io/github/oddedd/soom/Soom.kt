package io.github.oddedd.soom

import android.content.Context
import android.provider.Settings
import android.util.AttributeSet
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import kotlin.math.min

private const val REDUCED_MOTION_T = 0.6

/**
 * Rotating dot-sphere loader. Size it with `Modifier.size(48.dp)`.
 * Dots are black unless [color] is given.
 */
@Composable
fun Soom(
    modifier: Modifier = Modifier,
    variant: Variant = Variant.Orbit,
    color: Color = Color.Black,
    count: Int = Presets.Defaults.count,
    speed: Double = Presets.Defaults.speed,
    label: String = "Loading",
) {
    val context = LocalContext.current
    val reduceMotion = remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    var t by remember { mutableDoubleStateOf(REDUCED_MOTION_T) }

    // The frame clock stops while the window is hidden, which pauses this loop.
    LaunchedEffect(speed, reduceMotion) {
        if (reduceMotion) {
            t = REDUCED_MOTION_T
            return@LaunchedEffect
        }
        var last = withFrameNanos { it }
        while (true) {
            withFrameNanos { now ->
                t += (now - last) / 1e9 * speed
                last = now
            }
        }
    }

    Canvas(
        modifier
            .aspectRatio(1f)
            .semantics {
                contentDescription = label
                progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
            },
    ) {
        val side = min(size.width, size.height)
        val half = side / 2
        val base = side * 0.022f * Presets.Defaults.dotScale.toFloat()
        val minAlpha = Presets.Defaults.minAlpha.toFloat()
        for (dot in computeFrame(variant, count, t)) {
            val depth = dot.depth.toFloat()
            val fade = dot.fade.toFloat()
            drawCircle(
                color = color,
                radius = base * (0.45f + 0.75f * depth) * (0.5f + 0.5f * fade),
                center = Offset(half + dot.x.toFloat() * half, half + dot.y.toFloat() * half),
                alpha = (minAlpha + (1 - minAlpha) * depth) * fade,
            )
        }
    }
}

/** View wrapper for XML layouts: `<io.github.oddedd.soom.SoomView .../>`. */
class SoomView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : AbstractComposeView(context, attrs, defStyleAttr) {
    var variant by mutableStateOf(Variant.Orbit)
    var color by mutableStateOf(Color.Black)

    @Composable
    override fun Content() {
        Soom(variant = variant, color = color)
    }
}
