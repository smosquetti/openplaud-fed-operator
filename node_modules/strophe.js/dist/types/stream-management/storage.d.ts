import { SMState, SMStorageBackend } from './types';
/**
 * In-memory storage backend (Node, tests, or non-resumable setups).
 * State is serialized on save so callers can't mutate stored state by reference.
 */
export declare class MemoryStorageBackend implements SMStorageBackend {
    private store;
    constructor();
    /**
     * @param key
     */
    load(key: string): SMState;
    /**
     * @param key
     * @param state
     */
    save(key: string, state: SMState): void;
    /**
     * @param key
     */
    clear(key: string): void;
}
/**
 * sessionStorage-backed storage backend (browser pages).
 * Survives page reloads within a tab, which is exactly the resumption window.
 */
export declare class SessionStorageBackend implements SMStorageBackend {
    constructor();
    /**
     * @param key
     */
    load(key: string): SMState;
    /**
     * @param key
     * @param state
     */
    save(key: string, state: SMState): void;
    /**
     * @param key
     */
    clear(key: string): void;
}
//# sourceMappingURL=storage.d.ts.map