/** Redis key holding the assembled RegistrySnapshot JSON. */
export const REGISTRY_SNAPSHOT_CACHE_KEY = 'orbit:registry:snapshot';

/** Redis pub/sub channel notified after every successful sync (assistant-service subscribes). */
export const SYNC_COMPLETED_CHANNEL = 'orbit:sync:completed';
