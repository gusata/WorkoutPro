package com.workoutpro.wear

import android.content.Context
import android.net.Uri
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.util.UUID

/** Wearable Data Layer access: reads the phone's state DataItem and sends actions as messages. */
object PhoneLink {
    const val STATE_PATH = "/workout/state"
    const val PATH_SET_DONE = "/workout/set-done"
    const val PATH_REST = "/workout/rest"
    const val PATH_START = "/workout/start"
    const val PATH_FINISH = "/workout/finish"
    /** Declared by the phone app in res/values/wear.xml. */
    private const val PHONE_CAPABILITY = "workoutpro_phone"

    /** Latest /workout/state (json, updatedAt) from any connected phone, or null if there is none yet. */
    suspend fun readState(context: Context): Pair<String, Long>? = try {
        val uri = Uri.Builder().scheme(PutDataRequest.WEAR_URI_SCHEME).path(STATE_PATH).build()
        val buffer = Wearable.getDataClient(context).getDataItems(uri).await()
        try {
            buffer.mapNotNull { item ->
                val map = DataMapItem.fromDataItem(item).dataMap
                val json = map.getString("json") ?: return@mapNotNull null
                json to map.getLong("updatedAt")
            }.maxByOrNull { it.second }
        } finally {
            buffer.release()
        }
    } catch (error: Exception) {
        null
    }

    /** Sends an action to the phone app. False when no phone is reachable. */
    suspend fun send(context: Context, path: String, payload: JSONObject = JSONObject()): Boolean = try {
        if (!payload.has("id")) payload.put("id", UUID.randomUUID().toString())
        val nodes = phoneNodeIds(context)
        if (nodes.isEmpty()) {
            false
        } else {
            val bytes = payload.toString().toByteArray(Charsets.UTF_8)
            val client = Wearable.getMessageClient(context)
            var sent = false
            for (node in nodes) {
                try {
                    client.sendMessage(node, path, bytes).await()
                    sent = true
                } catch (error: Exception) {
                    // Try the next node.
                }
            }
            sent
        }
    } catch (error: Exception) {
        false
    }

    private suspend fun phoneNodeIds(context: Context): List<String> {
        val withApp = try {
            Wearable.getCapabilityClient(context)
                .getCapability(PHONE_CAPABILITY, CapabilityClient.FILTER_REACHABLE).await()
                .nodes.sortedByDescending { it.isNearby }.map { it.id }
        } catch (error: Exception) {
            emptyList()
        }
        if (withApp.isNotEmpty()) return withApp
        // Capability not propagated yet (fresh install): fall back to any connected node.
        return try {
            Wearable.getNodeClient(context).connectedNodes.await().map { it.id }
        } catch (error: Exception) {
            emptyList()
        }
    }
}
