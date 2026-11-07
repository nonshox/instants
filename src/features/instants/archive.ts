export type ArchiveSyncState = "local" | "uploading" | "uploaded" | "failed";

export type ArchivedInstant = {
  localId: string;
  ownerId: string;
  originalDate: number;
  createdAt: number;
  caption: string;
  image: Blob;
  mimeType: string;
  likes: number;
  serverId: string | null;
  syncState: ArchiveSyncState;
};

const databaseName = "instant-local-archive";
const storeName = "instants";
let databasePromise: Promise<IDBDatabase> | null = null;

export function createLocalInstant(
  ownerId: string,
  image: Blob,
  caption: string,
  originalDate: number,
  mimeType: string,
): ArchivedInstant {
  return {
    localId: crypto.randomUUID(),
    ownerId,
    originalDate,
    createdAt: Date.now(),
    caption,
    image,
    mimeType,
    likes: 0,
    serverId: null,
    syncState: "local",
  };
}

export async function saveArchivedInstant(
  instant: ArchivedInstant,
): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(instant);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Archive save failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Archive save was aborted."));
  });
}

export async function listArchivedInstants(
  ownerId: string,
): Promise<ArchivedInstant[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction
      .objectStore(storeName)
      .index("ownerId")
      .getAll(IDBKeyRange.only(ownerId));
    request.onsuccess = () => {
      const instants = request.result as ArchivedInstant[];
      resolve(instants.sort((first, second) => second.originalDate - first.originalDate));
    };
    request.onerror = () => reject(request.error ?? new Error("Archive lookup failed."));
  });
}

export async function deleteArchivedInstant(localId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(localId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Archive deletion failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Archive deletion was aborted."));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new Error("This browser does not support a local photo archive.");
  }
  if (databasePromise) {
    return databasePromise;
  }

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore(storeName, {
        keyPath: "localId",
      });
      store.createIndex("ownerId", "ownerId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the local archive."));
    request.onblocked = () =>
      reject(new Error("Local archive upgrade is blocked by another tab."));
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = opening;
  return opening;
}
