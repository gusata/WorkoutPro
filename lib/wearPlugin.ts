import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** Raw action as stored by the native side (one per Data Layer message from the watch). */
export interface NativeWearAction {
  /** Message path without the "/workout/" prefix: set-done, rest, start, finish. */
  type: string
  /** JSON payload sent by the watch (may be empty). */
  payload: string
  /** Phone wall-clock time (ms) when the message arrived. */
  receivedAt: number
}

export interface WearBridgePluginInterface {
  /** Publishes the session state as the /workout/state DataItem. */
  pushState(options: { json: string }): Promise<void>
  /** Returns and clears the queue of watch actions kept in SharedPreferences. */
  drainActions(): Promise<{ actions: NativeWearAction[] }>
  /** Fired when the watch sent something; the payload is in the queue (call drainActions). */
  addListener(event: 'actionsAvailable', listener: () => void): Promise<PluginListenerHandle>
}

export const WearBridgePlugin = registerPlugin<WearBridgePluginInterface>('WearBridge', {
  web: {
    async pushState() {},
    async drainActions() { return { actions: [] } },
    async addListener() { return { remove: async () => {} } },
  } as unknown as WearBridgePluginInterface,
})
