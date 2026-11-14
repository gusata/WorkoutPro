package com.workoutpro.wear

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/** Receives /workout/state from the phone, also when the watch app is not open. */
class StateListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            if (item.uri.path != PhoneLink.STATE_PATH) continue
            val map = DataMapItem.fromDataItem(item).dataMap
            val json = map.getString("json") ?: continue
            WorkoutRepository.onPhoneState(applicationContext, json, map.getLong("updatedAt"))
        }
    }
}
