const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
const cacheStore = new Map<string, any>();

export const cacheManager = {
    get: <T>(key: string): T | undefined => {
        if (!cacheEnabled) return undefined;
        return cacheStore.get(key);
    },
    set: (key: string, value: any) => {
        if (!cacheEnabled) return;
        cacheStore.set(key, value);
    },
    del: (key: string | string[]) => {
        if (!cacheEnabled) return;
        if (Array.isArray(key)) {
            key.forEach(k => cacheStore.delete(k));
        } else {
            cacheStore.delete(key);
        }
    },
    delByPrefix: (prefix: string) => {
        if (!cacheEnabled) return;
        for (const key of cacheStore.keys()) {
            if (key.startsWith(prefix)) {
                cacheStore.delete(key);
            }
        }
    },
    flush: () => {
        cacheStore.clear();
    }
};
