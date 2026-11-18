package com.workoutpro.app.wear

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

/**
 * Phone side of the Wear OS companion.
 * - pushState: publishes the session snapshot built in JS as the /workout/state DataItem.
 * - drainActions: hands the queued watch actions (see [WearActionStore]) to JS.
 * - "actionsAvailable" event: fired when the watch sent something while the app is alive.
 */
@CapacitorPlugin(name = "WearBridge")
class WearBridgePlugin : Plugin() {

    override fun load() {
        active = this
    }

    override fun handleOnResume() {
        super.handleOnResume()
        if (!WearActionStore.isEmpty(context)) notifyActionsAvailable()
    }

    override fun handleOnDestroy() {
        if (active === this) active = null
        super.handleOnDestroy()
    }

    @PluginMethod
    fun pushState(call: PluginCall) {
        val json = call.getString("json")
        if (json.isNullOrEmpty()) {
            call.reject("Estado vazio")
            return
        }
        try {
            val request = PutDataMapRequest.create(STATE_PATH).apply {
                dataMap.putString("json", json)
                dataMap.putLong("updatedAt", System.currentTimeMillis())
            }.asPutDataRequest().setUrgent()
            Wearable.getDataClient(context).putDataItem(request)
                .addOnSuccessListener { call.resolve() }
                .addOnFailureListener { error -> call.reject("Relogio indisponivel", error as? Exception) }
        } catch (error: Exception) {
            // No Google Play services / Wear OS app on this phone.
            call.reject("Relogio indisponivel", error)
        }
    }

    @PluginMethod
    fun drainActions(call: PluginCall) {
        val queue = WearActionStore.drain(context)
        val actions = JSArray()
        for (i in 0 until queue.length()) actions.put(queue.getJSONObject(i))
        call.resolve(JSObject().put("actions", actions))
    }

    internal fun notifyActionsAvailable() {
        // retainUntilConsumed: delivered later if JS has not subscribed yet.
        notifyListeners(EVENT_ACTIONS, JSObject(), true)
    }

    companion object {
        const val STATE_PATH = "/workout/state"
        const val EVENT_ACTIONS = "actionsAvailable"

        @Volatile
        internal var active: WearBridgePlugin? = null

        /** True when a live plugin (and so a WebView) was told about new actions. */
        fun notifyIfAlive(): Boolean {
            val plugin = active ?: return false
            plugin.notifyActionsAvailable()
            return true
        }
    }
}
