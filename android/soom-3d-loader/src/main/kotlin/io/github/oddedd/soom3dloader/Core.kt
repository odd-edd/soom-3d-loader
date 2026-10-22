// Pure frame math. Mirrors SPEC.md section by section; keep it in sync with
// packages/web/src/core.ts and ios/Sources/Soom3DLoader/Core.swift.
package io.github.oddedd.soom3dloader

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

enum class Variant(
    val key: String,
    internal val extent: Double,
    internal val tilt: Double,
    internal val spin: Double,
) {
    Orbit("orbit", Presets.Orbit.extent, Presets.Orbit.tilt, Presets.Orbit.spin),
    Wave("wave", Presets.Wave.extent, Presets.Wave.tilt, Presets.Wave.spin),
    Morph("morph", Presets.Morph.extent, Presets.Morph.tilt, Presets.Morph.spin),
    Breathe("breathe", Presets.Breathe.extent, Presets.Breathe.tilt, Presets.Breathe.spin),
    Surf("surf", Presets.Surf.extent, Presets.Surf.tilt, Presets.Surf.spin),
    Helix("helix", Presets.Helix.extent, Presets.Helix.tilt, Presets.Helix.spin),
    Twist("twist", Presets.Twist.extent, Presets.Twist.tilt, Presets.Twist.spin),
    Chase("chase", Presets.Chase.extent, Presets.Chase.tilt, Presets.Chase.spin),
    Comet("comet", Presets.Comet.extent, Presets.Comet.tilt, Presets.Comet.spin),
    Bounce("bounce", Presets.Bounce.extent, Presets.Bounce.tilt, Presets.Bounce.spin),
    Pulse("pulse", Presets.Pulse.extent, Presets.Pulse.tilt, Presets.Pulse.spin),
    Beat("beat", Presets.Beat.extent, Presets.Beat.tilt, Presets.Beat.spin),
    Cube("cube", Presets.Cube.extent, Presets.Cube.tilt, Presets.Cube.spin),
    Trio("trio", Presets.Trio.extent, Presets.Trio.tilt, Presets.Trio.spin),
    Atom("atom", Presets.Atom.extent, Presets.Atom.tilt, Presets.Atom.spin);

    companion object {
        fun fromKey(key: String): Variant? = entries.firstOrNull { it.key == key }
    }
}

/** [fade] (0–1, almost always 1) thins out trails: renderers multiply alpha by it and shrink the dot. */
data class Dot(val x: Double, val y: Double, val depth: Double, val fade: Double = 1.0)

private class Vec(val x: Double, val y: Double, val z: Double) {
    operator fun times(s: Double) = Vec(x * s, y * s, z * s)
    operator fun plus(o: Vec) = Vec(x + o.x, y + o.y, z + o.z)
}

private val GOLDEN_ANGLE = PI * (3 - sqrt(5.0))
private const val TAU = 2 * PI

private fun smooth(a: Double) = a * a * (3 - 2 * a)

fun hash01(i: Int): Double {
    var x = (i + 1) * 2654435761L.toInt()
    x = x xor (x ushr 16)
    x *= 0x45d9f3b
    x = x xor (x ushr 16)
    return (x.toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
}

/** Point [i] of [n] on a Fibonacci sphere (unit radius). */
private fun fib(i: Int, n: Int): Vec {
    val y = 1 - 2 * (i + 0.5) / n
    val r = sqrt(1 - y * y)
    val th = GOLDEN_ANGLE * i
    return Vec(cos(th) * r, y, sin(th) * r)
}

private fun rotX(p: Vec, b: Double) = Vec(p.x, p.y * cos(b) - p.z * sin(b), p.y * sin(b) + p.z * cos(b))
private fun rotY(p: Vec, g: Double) = Vec(p.x * cos(g) + p.z * sin(g), p.y, -p.x * sin(g) + p.z * cos(g))
private fun rotZ(p: Vec, g: Double) = Vec(p.x * cos(g) - p.y * sin(g), p.x * sin(g) + p.y * cos(g), p.z)

/** Largest n ≥ 2 with n³ ≤ count (integer-only so every platform agrees). */
private fun cubeSide(count: Int): Int {
    var n = 2
    while ((n + 1) * (n + 1) * (n + 1) <= count) n++
    return n
}

/** Grid divisions per cube edge for morph: largest n ≥ 1 with 6n² + 2 ≤ count. */
private fun morphSide(count: Int): Int {
    var n = 1
    while (6 * (n + 1) * (n + 1) + 2 <= count) n++
    return n
}

/** How many dots a variant draws for a requested count (grid variants round down). */
fun dotCount(variant: Variant, requested: Int): Int = when (variant) {
    Variant.Morph -> {
        val n = morphSide(requested)
        6 * n * n + 2
    }
    Variant.Cube -> {
        val n = cubeSide(requested)
        n * n * n
    }
    else -> requested
}

/** Position of dot [i] (of [count]) before the shared rotation. */
private fun place(variant: Variant, i: Int, count: Int, t: Double): Vec {
    val u = i.toDouble() / count
    val s0 = fib(i, count)
    val r = sqrt(1 - s0.y * s0.y)
    val th = GOLDEN_ANGLE * i
    fun crest(angle: Double, rate: Double, sharpness: Double) = ((1 + cos(angle - rate * t)) / 2).pow(sharpness)

    return when (variant) {
        Variant.Orbit -> s0
        Variant.Wave -> {
            val p = Presets.Wave
            s0 * (1 + p.amplitude * sin(s0.y * p.frequency + 3 * t) * cos(0.5 * th + t))
        }
        Variant.Morph -> {
            // Lattice points on the cube's surface, edges and corners included (each once), in
            // a fixed scan order; blends between the normalised (sphere) and flat (cube) point.
            val n = morphSide(count)
            var q = Vec(0.0, 0.0, 0.0)
            var seen = -1
            scan@ for (a in 0..n) {
                for (b in 0..n) {
                    for (c in 0..n) {
                        if (a % n != 0 && b % n != 0 && c % n != 0) continue
                        seen++
                        if (seen == i) {
                            q = Vec(-1 + 2.0 * a / n, -1 + 2.0 * b / n, -1 + 2.0 * c / n)
                            break@scan
                        }
                    }
                }
            }
            val len = sqrt(q.x * q.x + q.y * q.y + q.z * q.z)
            val m = smooth((sin(Presets.Morph.rate * t) + 1) / 2)
            q * (1 / len + (Presets.Morph.cubeSize - 1 / len) * m)
        }
        Variant.Breathe -> {
            val p = Presets.Breathe
            val e = smooth(max(0.0, sin(p.rate * t)))
            s0 * (1 + e * p.spread * (0.5 + hash01(i)))
        }
        Variant.Surf -> {
            // Crest sweeps left to right around the sphere; swells most at the equator, a little at the poles.
            val p = Presets.Surf
            val c = crest(-th, p.rate, p.sharpness)
            s0 * (1 + p.amplitude * c * (p.poleSwell + (1 - p.poleSwell) * r.pow(p.equatorBias)))
        }
        Variant.Helix -> {
            val p = Presets.Helix
            val half = ((count + 1) / 2).toDouble()
            val w = (i / 2) / half
            val a = TAU * p.turns * w + (i % 2) * PI
            val rad = p.radius * (1 + p.pulse * sin(2 * TAU * w - p.rate * t))
            Vec(cos(a) * rad, 0.9 * (2 * w - 1), sin(a) * rad)
        }
        Variant.Twist -> {
            val p = Presets.Twist
            val a = p.amount * sin(p.rate * t) * s0.y
            Vec(s0.x * cos(a) - s0.z * sin(a), s0.y, s0.x * sin(a) + s0.z * cos(a))
        }
        Variant.Chase -> {
            // Beads (little dotted balls) round a ring, like a classic spinner. A crest runs round:
            // the bead under it comes forward and grows, the rest sit back, small and faint.
            val p = Presets.Chase
            val beads = p.beads.roundToInt()
            val bead = i % beads
            val per = (count + beads - 1) / beads
            val a = TAU * bead / beads
            val c = crest(a, p.rate, p.sharpness)
            val q = fib(i / beads, per)
            val br = p.beadRadius * (0.55 + 0.6 * c)
            Vec(cos(a) * p.radius + q.x * br, sin(a) * p.radius + q.y * br, p.lift * (2 * c - 1) + q.z * br)
        }
        Variant.Comet -> {
            // A comet on a tilted orbit: thick head, thinning tail; more dots near the head.
            val p = Presets.Comet
            val s = u.pow(1.6)
            val a = p.rate * t - TAU * p.length * s
            val rho = p.headRadius * (1 - s).pow(1.2) + 0.01
            val ring = p.radius + cos(th) * rho
            Vec(ring * cos(a), sin(th) * rho, ring * sin(a))
        }
        Variant.Bounce -> {
            // Three dotted balls hopping one after another, each slowly turning.
            val p = Presets.Bounce
            val ball = i % 3
            val per = (count + 2) / 3
            val q = rotY(fib(i / 3, per), p.rate * t)
            val hop = p.height * max(0.0, sin(p.rate * t - ball * p.delay))
            Vec(q.x * p.ballRadius + (ball - 1) * p.gap, q.y * p.ballRadius - hop, q.z * p.ballRadius)
        }
        Variant.Pulse -> {
            // Rings of dots spreading from the centre and sinking back as they widen.
            val p = Presets.Pulse
            val rings = p.rings.roundToInt()
            val k = i % rings
            val per = (count + rings - 1) / rings
            val phase = p.rate * t + k.toDouble() / rings
            val f = phase - floor(phase)
            val rr = 0.12 + 0.88 * f
            val a = TAU * (i / rings) / per
            Vec(cos(a) * rr, p.sink * f * f, sin(a) * rr)
        }
        Variant.Beat -> {
            // A row of bars on a gentle arc, each a 2x2 column of dots, rising and falling like an
            // equaliser; bars grow up and down from the middle.
            val p = Presets.Beat
            val bars = p.bars.roundToInt()
            val b = i % bars
            val k = i / bars
            val per = ceil(count.toDouble() / bars / 4).toInt()
            val s = ((k / 4) + 0.5) / per - 0.5
            val level = (0.5 + 0.5 * sin(p.rate * t - b * p.phase)).pow(2)
            val h = p.minHeight + (p.maxHeight - p.minHeight) * level
            val x = (b - (bars - 1) / 2.0) * p.gap
            val ox = (if (k % 2 == 0) -1.0 else 1.0) * p.thickness
            val oz = (if ((k / 2) % 2 == 0) -1.0 else 1.0) * p.thickness
            Vec(x + ox, s * h, -p.arc * x * x + oz)
        }
        Variant.Cube -> {
            // A grid cube whose layers turn a quarter turn one after another, like a puzzle cube.
            val p = Presets.Cube
            val n = cubeSide(count)
            fun g(k: Int) = p.size * (-1 + 2 * (k + 0.5) / n)
            val q = Vec(g(i / (n * n)), g((i / n) % n), g(i % n))
            val stepD = floor(p.rate * t)
            val step = stepD.toInt()
            val turn = smooth(p.rate * t - stepD) * (PI / 2)
            val axis = step % 3
            val layer = g((step / 3) % n)
            val coord = when (axis) { 0 -> q.x; 1 -> q.y; else -> q.z }
            if (abs(coord - layer) > 1e-9) return q
            val c = cos(turn)
            val sn = sin(turn)
            when (axis) {
                0 -> Vec(q.x, q.y * c - q.z * sn, q.y * sn + q.z * c)
                1 -> Vec(q.x * c + q.z * sn, q.y, -q.x * sn + q.z * c)
                else -> Vec(q.x * c - q.y * sn, q.x * sn + q.y * c, q.z)
            }
        }
        Variant.Trio -> {
            // Three dotted balls chasing each other round a tilted circle.
            val p = Presets.Trio
            val ball = i % 3
            val per = (count + 2) / 3
            val q = fib(i / 3, per)
            val a = p.rate * t + ball * TAU / 3
            val rr = p.ballRadius * (1 + p.pulse * sin(p.rate * 2 * t + ball * 2))
            Vec(q.x * rr + cos(a) * p.radius, q.y * rr, q.z * rr + sin(a) * p.radius)
        }
        Variant.Atom -> {
            // A nucleus of jiggling nucleons and three electrons (dense little balls) flying round
            // it on crossed orbits, each leaving a trail along its orbit.
            val p = Presets.Atom
            val nucleusN = (count * p.nucleusShare).toInt()
            if (i < nucleusN) {
                val nucleon = i % 8
                val per = (nucleusN + 7) / 8
                val jiggle = 1 + 0.08 * sin(p.rate * 3 * t + nucleon * 1.7)
                return fib(nucleon, 8) * (p.nucleusRadius * jiggle) + fib(i / 8, per) * p.nucleonRadius
            }
            // Each electron's dots are split between its ball and a trail along its orbit behind it,
            // packed tight near the electron and thinning out further back.
            val j = i - nucleusN
            val e = j % 3
            val k = j / 3
            val perElectron = (count - nucleusN + 2) / 3
            val ballN = max(1, (perElectron * p.electronShare).roundToInt())
            val head = p.rate * t * (1 + 0.15 * e) + e * TAU / 3
            fun orbitPoint(a: Double) =
                rotZ(rotX(Vec(cos(a) * p.orbitRadius, 0.0, sin(a) * p.orbitRadius), p.orbitTilt), e * PI / 3)
            if (k >= ballN) {
                val q = (k - ballN + 1).toDouble() / max(1, perElectron - ballN)
                return orbitPoint(head - TAU * p.trailLength * q.pow(1.7))
            }
            orbitPoint(head) + fib(k, ballN) * p.electronRadius
        }
    }
}

/** How strongly dot [i] is drawn, 0–1 (1 for almost every dot). Trails use it to thin out. */
private fun fade(variant: Variant, i: Int, count: Int): Double {
    if (variant != Variant.Atom) return 1.0
    val p = Presets.Atom
    val nucleusN = (count * p.nucleusShare).toInt()
    if (i < nucleusN) return 1.0
    val k = (i - nucleusN) / 3
    val perElectron = (count - nucleusN + 2) / 3
    val ballN = max(1, (perElectron * p.electronShare).roundToInt())
    if (k < ballN) return 1.0
    return 1 - p.trailFade * (k - ballN + 1) / max(1, perElectron - ballN)
}

/**
 * Dots sorted back to front. [t] is elapsed seconds already multiplied by speed.
 * Draws [dotCount] dots for [requested].
 */
fun computeFrame(variant: Variant, requested: Int, t: Double): List<Dot> {
    val d = Presets.Defaults
    val count = dotCount(variant, requested)
    val ca = cos(variant.spin * t)
    val sa = sin(variant.spin * t)
    val cb = cos(variant.tilt)
    val sb = sin(variant.tilt)
    val extent = variant.extent

    val dots = ArrayList<Dot>(count)
    for (i in 0 until count) {
        val p = place(variant, i, count, t)
        val x = p.x * ca + p.z * sa
        val z = -p.x * sa + p.z * ca
        val y = p.y * cb - z * sb
        val z2 = p.y * sb + z * cb
        val k = 1 / (1 - z2 * d.perspective)
        dots += Dot(x * k / extent, y * k / extent, min(1.0, max(0.0, (z2 / extent + 1) / 2)), fade(variant, i, count))
    }
    // sortedBy is stable, so equal depths keep index order as the spec requires.
    return dots.sortedBy { it.depth }
}
