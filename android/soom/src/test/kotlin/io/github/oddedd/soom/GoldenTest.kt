package io.github.oddedd.soom

import java.io.File
import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Checks the Kotlin core against spec/golden.json, produced by the web core. */
class GoldenTest {
    private val casePattern = Regex(
        """"variant":\s*"(\w+)",\s*"count":\s*(\d+),\s*"t":\s*([-\d.eE]+),\s*"frame":\s*\[([^\]]*)]""",
    )

    @Test
    fun matchesGoldenFrames() {
        // Unit tests run with the module directory (android/soom) as working dir.
        val json = File("../../spec/golden.json").readText()
        val tolerance = Regex(""""tolerance":\s*([-\d.eE]+)""").find(json)!!.groupValues[1].toDouble()
        val cases = casePattern.findAll(json).toList()
        assertTrue(cases.isNotEmpty())

        for (match in cases) {
            val (key, count, t, frame) = match.destructured
            val expected = frame.split(",").map { it.trim().toDouble() }
            val actual = computeFrame(Variant.fromKey(key)!!, count.toInt(), t.toDouble())
                .flatMap { listOf(it.x, it.y, it.depth, it.fade) }
            assertEquals(expected.size, actual.size)
            val worst = expected.zip(actual).maxOf { (a, b) -> abs(a - b) }
            assertTrue("$key t=$t max diff $worst", worst <= tolerance)
        }
    }
}
