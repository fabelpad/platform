type Adapter = { setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };

/** Snapshot immediately and serialize writes and deletion, including after an I/O failure. */
export function createStorageQueue(adapter: Adapter, key: string) {
  let writes: Promise<void> = Promise.resolve();
  const enqueue = (operation: () => Promise<void>) => {
    const result = writes.catch(() => {}).then(operation);
    writes = result;
    return result;
  };
  return {
    persist(value: unknown) { const serialized = JSON.stringify(value); return enqueue(() => adapter.setItem(key, serialized)); },
    remove() { return enqueue(() => adapter.removeItem(key)); },
  };
}
