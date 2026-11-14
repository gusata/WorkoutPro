package com.workoutpro.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkoutStateTest {
    private val json = """
        {"v":1,"active":true,"sessionId":"s1","workoutName":"Treino A","startedAt":1000,
         "exerciseId":"bench","exerciseName":"Supino","setId":"b2","setIndex":1,"setCount":3,"setType":"normal",
         "targetWeight":82.5,"targetReps":8,"targetMinReps":6,"targetMaxReps":10,"previousWeight":80,"previousReps":7,
         "weightStep":2.5,"restSeconds":120,"restEndAt":null,"restTotal":0,"doneSets":1,"totalSets":4,"allDone":false,
         "next":{"exerciseName":"Supino","setIndex":2,"setCount":3,"weight":85,"reps":6}}
    """.trimIndent()

    @Test
    fun parsesPhoneSnapshot() {
        val state = WorkoutState.parse(json, 42)!!
        assertEquals("Supino", state.exerciseName)
        assertEquals(82.5, state.targetWeight, 0.001)
        assertEquals(7, state.previousReps)
        assertNull(state.restEndAt)
        assertEquals(42L, state.updatedAt)
        assertEquals(85.0, state.next!!.weight, 0.001)
    }

    @Test
    fun optimisticSetDoneStartsRestAndMovesToNext() {
        val state = WorkoutState.parse(json, 42)!!.afterSetDone(now = 10_000)
        assertEquals(130_000L, state.restEndAt)
        assertTrue(state.isResting(10_001))
        assertEquals(2, state.setIndex)
        assertEquals(6, state.targetReps)
        assertEquals(2, state.doneSets)
        assertNull(state.setId)
        assertEquals(145_000L, state.withRestExtended(15, 10_000).restEndAt)
        assertNull(state.withRestSkipped().restEndAt)
    }

    @Test
    fun formatsWeightsLikeThePhone() {
        assertEquals("80", formatWeight(80.0))
        assertEquals("82,5", formatWeight(82.5))
        assertEquals("1,25", formatWeight(1.25))
        assertEquals("1:05", formatClock(65))
    }

    @Test
    fun rejectsGarbage() {
        assertNull(WorkoutState.parse("{oops", 1))
    }
}
