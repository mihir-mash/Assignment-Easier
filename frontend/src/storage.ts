export async function readStored<T>(key: string): Promise<T | undefined> {
  return transact<T>(key);
}
export async function writeStored<T>(key: string, value: T): Promise<void> {
  await transact<T>(key, value);
}
function transact<T>(key: string, value?: T): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open("inkmatch-workspace", 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore("records");
    opening.onerror = () =>
      reject(new Error("Browser storage is unavailable."));
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction(
        "records",
        value === undefined ? "readonly" : "readwrite",
      );
      const request =
        value === undefined
          ? transaction.objectStore("records").get(key)
          : transaction.objectStore("records").put(value, key);
      transaction.oncomplete = () => {
        database.close();
        resolve(
          value === undefined ? (request.result as T | undefined) : undefined,
        );
      };
      transaction.onerror = () => {
        database.close();
        reject(
          new Error("Could not save locally. Browser storage may be full."),
        );
      };
      transaction.onabort = transaction.onerror;
    };
  });
}
