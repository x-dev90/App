import {isClientTheLeader, isReady as isActiveClientReady} from '@libs/ActiveClientManager';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {AnyOnyxUpdate, AnyRequest} from '@src/types/onyx/Request';

import type {OnyxKey, OnyxUpdate} from 'react-native-onyx';

import Onyx from 'react-native-onyx';

type JSONValue = Record<string, unknown>;

type FieldChange = {
    path: string[];
    before: unknown;
    after: unknown;
};

type TransactionEdit = {
    requestID: string;
    transactionID: string;
    changes: FieldChange[];
    pendingFields: Record<string, unknown>;
    acknowledged?: boolean;
};

type PersistedState = {
    revision: number;
    confirmed: Record<string, JSONValue | null>;
    edits: TransactionEdit[];
};

const transactionPrefix = ONYXKEYS.COLLECTION.TRANSACTION;
const ignoredOptimisticFields = new Set(['pendingFields', 'errorFields', 'errors']);
let liveTransactions: Record<string, unknown> = {};
let state: PersistedState = {revision: 0, confirmed: {}, edits: []};
let freshnessGeneration = 0;
let isRecoveringAcknowledgedEdits = false;
const locallyAcknowledgedRequestIDs = new Set<string>();
let persistencePromise: Promise<void> = Promise.resolve();
let persistenceGeneration = 0;

// This manager sits below the UI and must see transaction writes before they are rendered.
Onyx.connectWithoutView({
    key: ONYXKEYS.COLLECTION.TRANSACTION,
    callback: (value) => {
        liveTransactions = value ?? {};
    },
});

// Pending edits survive reloads so a delayed response cannot expose its server snapshot before the
// persisted request that owns the edit has settled.
Onyx.connectWithoutView({
    key: ONYXKEYS.PENDING_TRANSACTION_EDITS,
    callback: (value) => {
        if (!value) {
            state = {revision: 0, confirmed: {}, edits: []};
            persistenceGeneration += 1;
            locallyAcknowledgedRequestIDs.clear();
            freshnessGeneration += 1;
            return;
        }
        if (!('confirmed' in value) || !('edits' in value)) {
            return;
        }
        const restoredState = value as PersistedState;
        if ((restoredState.revision ?? 0) < state.revision) {
            return;
        }
        state = {...restoredState, revision: restoredState.revision ?? 0};
        freshnessGeneration += 1;
        const acknowledgedRequestIDs = [...new Set(state.edits.filter((edit) => edit.acknowledged && !locallyAcknowledgedRequestIDs.has(edit.requestID)).map((edit) => edit.requestID))];
        if (acknowledgedRequestIDs.length === 0 || isRecoveringAcknowledgedEdits || !isClientTheLeader()) {
            return;
        }
        isRecoveringAcknowledgedEdits = true;
        const transactionIDs = [...new Set(state.edits.filter((edit) => edit.acknowledged).map((edit) => edit.transactionID))];
        Onyx.update(
            transactionIDs.map((transactionID) => ({
                onyxMethod: Onyx.METHOD.SET,
                key: `${transactionPrefix}${transactionID}` as `${typeof ONYXKEYS.COLLECTION.TRANSACTION}${string}`,
                value: getResultingTransaction(transactionID),
            })) as AnyOnyxUpdate[],
        ).then(
            () => {
                for (const requestID of acknowledgedRequestIDs) {
                    finalizeTransactionEdits({transactionEditRequestID: requestID} as AnyRequest);
                }
                isRecoveringAcknowledgedEdits = false;
            },
            () => {
                isRecoveringAcknowledgedEdits = false;
            },
        );
    },
});

function clone<T>(value: T): T {
    if (value === undefined || value === null) {
        return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is JSONValue {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeValue(base: unknown, patch: unknown): unknown {
    if (!isObject(patch) || !isObject(base)) {
        return clone(patch);
    }
    const result = clone(base);
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) {
            continue;
        }
        result[key] = isObject(value) && isObject(result[key]) ? mergeValue(result[key], value) : clone(value);
    }
    return result;
}

function collectChanges(before: unknown, after: unknown, path: string[] = []): FieldChange[] {
    if (isObject(after)) {
        return Object.entries(after).flatMap(([key, value]) => {
            if (path.length === 0 && ignoredOptimisticFields.has(key)) {
                return [];
            }
            return collectChanges(isObject(before) ? before[key] : undefined, value, [...path, key]);
        });
    }
    if (JSON.stringify(before) === JSON.stringify(after)) {
        return [];
    }
    return [{path, before: clone(before), after: clone(after)}];
}

function setAtPath(target: JSONValue, path: string[], value: unknown) {
    let cursor = target;
    for (const part of path.slice(0, -1)) {
        cursor[part] = isObject(cursor[part]) ? cursor[part] : {};
        cursor = cursor[part] as JSONValue;
    }
    cursor[path.at(-1) ?? ''] = clone(value);
}

function hasAtPath(target: unknown, path: string[]): boolean {
    let cursor = target;
    for (const part of path) {
        if (!isObject(cursor) || !(part in cursor)) {
            return false;
        }
        cursor = cursor[part];
    }
    return true;
}

function persist(): Promise<void> {
    state.revision += 1;
    const nextState = clone(state);
    const generation = persistenceGeneration;
    persistencePromise = persistencePromise
        .catch(() => undefined)
        .then(async () => {
            if (generation !== persistenceGeneration) {
                return;
            }
            if (isClientTheLeader()) {
                await Onyx.set(ONYXKEYS.PENDING_TRANSACTION_EDITS, nextState);
                return;
            }
            // The active-client list may not be initialized yet during startup restoration. Once it is,
            // only its leader publishes the shared transaction-edit journal.
            await isActiveClientReady();
            if (generation === persistenceGeneration && isClientTheLeader()) {
                await Onyx.set(ONYXKEYS.PENDING_TRANSACTION_EDITS, nextState);
            }
        });
    // Registration is synchronous by design; response application explicitly awaits this promise.
    persistencePromise.catch(() => {});
    return persistencePromise;
}

function getTransactionEditPersistencePromise() {
    return persistencePromise;
}

function transactionIDFromKey(key: string): string | undefined {
    if (!key.startsWith(transactionPrefix) || key === transactionPrefix) {
        return undefined;
    }
    return key.slice(transactionPrefix.length);
}

function getTransactionUpdates(updates: AnyOnyxUpdate[] | undefined): Array<{transactionID: string; value: unknown; method: string}> {
    const result: Array<{transactionID: string; value: unknown; method: string}> = [];
    for (const update of updates ?? []) {
        const transactionID = transactionIDFromKey(String(update.key));
        if (transactionID) {
            result.push({transactionID, value: update.value, method: update.onyxMethod});
            continue;
        }
        if (String(update.key) !== transactionPrefix || !isObject(update.value)) {
            continue;
        }
        for (const [key, value] of Object.entries(update.value)) {
            result.push({transactionID: transactionIDFromKey(key) ?? key, value, method: update.onyxMethod});
        }
    }
    return result;
}

function getResultingTransaction(transactionID: string): JSONValue | null {
    const confirmed = clone(state.confirmed[transactionID]);
    if (!confirmed) {
        return confirmed;
    }
    const result = confirmed;
    const pendingFields: Record<string, unknown> = {...(isObject(result.pendingFields) ? result.pendingFields : {})};
    for (const edit of state.edits) {
        if (edit.transactionID !== transactionID || edit.acknowledged) {
            continue;
        }
        for (const change of edit.changes) {
            setAtPath(result, change.path, change.after);
        }
        Object.assign(pendingFields, edit.pendingFields);
    }
    result.pendingFields = pendingFields;
    return result;
}

function isMergeMethod(method: string) {
    return method === Onyx.METHOD.MERGE || method === Onyx.METHOD.MERGE_COLLECTION;
}

function registerTransactionEdits(request: AnyRequest, optimisticData: AnyOnyxUpdate[] | undefined) {
    if (request.data?.apiRequestType !== CONST.API_REQUEST_TYPE.WRITE || request.requestIndex === undefined) {
        return;
    }
    const requestID = String(request.requestIndex);
    const optimisticValues = new Map<string, JSONValue | null>();
    for (const update of getTransactionUpdates(optimisticData)) {
        if (!isObject(update.value)) {
            continue;
        }
        const key = `${transactionPrefix}${update.transactionID}`;
        const liveValue = liveTransactions[key];
        const storedLive = isObject(liveValue) ? liveValue : null;
        const live = optimisticValues.get(update.transactionID) ?? storedLive;
        if (!(update.transactionID in state.confirmed)) {
            state.confirmed[update.transactionID] = clone(storedLive);
        }
        const optimisticResult = isMergeMethod(update.method) ? mergeValue(live, update.value) : update.value;
        optimisticValues.set(update.transactionID, clone(optimisticResult) as JSONValue | null);
        const changes = collectChanges(live, optimisticResult);
        if (changes.length === 0) {
            continue;
        }
        const pendingFields = isObject(update.value.pendingFields) ? Object.fromEntries(Object.entries(update.value.pendingFields).filter(([, pendingAction]) => !!pendingAction)) : {};
        state.edits.push({requestID, transactionID: update.transactionID, changes, pendingFields});
    }
    if (state.edits.some((edit) => edit.requestID === requestID)) {
        request.transactionEditRequestID = requestID;
        freshnessGeneration += 1;
        persist();
    }
}

function applyServerUpdate(transactionID: string, value: unknown, method: string) {
    if (value === null) {
        state.confirmed[transactionID] = null;
        return;
    }
    const liveValue = liveTransactions[`${transactionPrefix}${transactionID}`];
    const current = state.confirmed[transactionID] ?? (isObject(liveValue) ? liveValue : null);
    state.confirmed[transactionID] = (isMergeMethod(method) ? mergeValue(current, value) : clone(value)) as JSONValue;
}

function replaceSnapshotTransactions(value: unknown, resulting: Map<string, JSONValue | null>): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => replaceSnapshotTransactions(item, resulting));
    }
    if (!isObject(value)) {
        return value;
    }
    const output: JSONValue = {};
    for (const [key, child] of Object.entries(value)) {
        const transactionID = transactionIDFromKey(key);
        output[key] = transactionID && resulting.has(transactionID) ? clone(resulting.get(transactionID)) : replaceSnapshotTransactions(child, resulting);
    }
    return output;
}

function collectSnapshotTransactionIDs(value: unknown, transactionIDs: Set<string>) {
    if (Array.isArray(value)) {
        for (const child of value) {
            collectSnapshotTransactionIDs(child, transactionIDs);
        }
        return;
    }
    if (!isObject(value)) {
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        const transactionID = transactionIDFromKey(key);
        if (transactionID) {
            transactionIDs.add(transactionID);
        } else {
            collectSnapshotTransactionIDs(child, transactionIDs);
        }
    }
}

/** Rebase server data and request lifecycle updates onto the field edits that still own each transaction. */
function protectTransactionUpdates<TKey extends OnyxKey>(
    request: AnyRequest | undefined,
    response: {jsonCode?: number | string} | undefined,
    updates: Array<OnyxUpdate<TKey>> | undefined,
): Array<OnyxUpdate<TKey>> | undefined {
    const transactionUpdates = getTransactionUpdates(updates);
    const requestID = request?.transactionEditRequestID;
    const protectedTransactionIDs = new Set(state.edits.map((edit) => edit.transactionID));
    if (protectedTransactionIDs.size === 0 && !requestID) {
        return updates;
    }
    const affected = new Set<string>();
    for (const update of transactionUpdates) {
        if (!protectedTransactionIDs.has(update.transactionID)) {
            continue;
        }
        applyServerUpdate(update.transactionID, update.value, update.method);
        affected.add(update.transactionID);
    }
    const snapshotTransactionIDs = new Set<string>();
    for (const update of updates ?? []) {
        collectSnapshotTransactionIDs(update.value, snapshotTransactionIDs);
    }
    for (const transactionID of snapshotTransactionIDs) {
        if (protectedTransactionIDs.has(transactionID)) {
            affected.add(transactionID);
        }
    }
    for (const update of updates ?? []) {
        if (String(update.key) !== transactionPrefix || update.onyxMethod !== Onyx.METHOD.SET_COLLECTION || !isObject(update.value)) {
            continue;
        }
        for (const transactionID of protectedTransactionIDs) {
            const fullKey = `${transactionPrefix}${transactionID}`;
            if (!(transactionID in update.value) && !(fullKey in update.value)) {
                state.confirmed[transactionID] = null;
                affected.add(transactionID);
            }
        }
    }
    if (requestID) {
        for (const edit of state.edits) {
            if (edit.requestID !== requestID) {
                continue;
            }
            affected.add(edit.transactionID);
            if (response?.jsonCode === 200) {
                const confirmed = state.confirmed[edit.transactionID];
                const serverUpdates = transactionUpdates.filter((update) => update.transactionID === edit.transactionID);
                if (confirmed) {
                    for (const change of edit.changes) {
                        if (!serverUpdates.some((update) => hasAtPath(update.value, change.path))) {
                            setAtPath(confirmed, change.path, change.after);
                        }
                    }
                }
            }
            edit.acknowledged = true;
            locallyAcknowledgedRequestIDs.add(requestID);
        }
        freshnessGeneration += 1;
    }
    const resulting = new Map<string, JSONValue | null>();
    for (const transactionID of affected) {
        resulting.set(transactionID, getResultingTransaction(transactionID));
    }
    const filtered: AnyOnyxUpdate[] = (updates ?? []).map((update) => ({...update, value: replaceSnapshotTransactions(update.value, resulting)}));
    const resultingUpdates: AnyOnyxUpdate[] = [...resulting].map(([transactionID, value]) => ({
        onyxMethod: Onyx.METHOD.SET,
        key: `${transactionPrefix}${transactionID}`,
        value,
    }));
    persist();
    return [...filtered, ...resultingUpdates] as unknown as Array<OnyxUpdate<TKey>>;
}

/** Keep lifecycle error feedback, but never let a request's full rollback snapshot replace newer confirmed data. */
function protectTransactionLifecycleUpdates<TKey extends OnyxKey>(updates: Array<OnyxUpdate<TKey>> | undefined): Array<OnyxUpdate<TKey>> | undefined {
    const transactionUpdates = getTransactionUpdates(updates);
    if (transactionUpdates.length === 0) {
        return updates;
    }
    const resulting = new Map<string, JSONValue | null>();
    for (const update of transactionUpdates) {
        const transaction = getResultingTransaction(update.transactionID);
        if (transaction && isObject(update.value)) {
            if ('errors' in update.value) {
                transaction.errors = clone(update.value.errors);
            }
            if ('errorFields' in update.value) {
                transaction.errorFields = clone(update.value.errorFields);
            }
        }
        resulting.set(update.transactionID, transaction);
    }
    const filtered: AnyOnyxUpdate[] = (updates ?? []).map((update) => ({...update, value: replaceSnapshotTransactions(update.value, resulting)}));
    const resultingUpdates: AnyOnyxUpdate[] = [...resulting].map(([transactionID, value]) => ({
        onyxMethod: Onyx.METHOD.SET,
        key: `${transactionPrefix}${transactionID}`,
        value,
    }));
    return [...filtered, ...resultingUpdates] as unknown as Array<OnyxUpdate<TKey>>;
}

function finalizeTransactionEdits(request: AnyRequest) {
    const requestID = request.transactionEditRequestID;
    if (!requestID) {
        return;
    }
    const transactionIDs = new Set(state.edits.filter((edit) => edit.requestID === requestID).map((edit) => edit.transactionID));
    state.edits = state.edits.filter((edit) => edit.requestID !== requestID);
    locallyAcknowledgedRequestIDs.delete(requestID);
    for (const transactionID of transactionIDs) {
        if (!state.edits.some((edit) => edit.transactionID === transactionID)) {
            delete state.confirmed[transactionID];
        }
    }
    persist();
}

function discardTransactionEdits(requestIDs: string[]) {
    if (requestIDs.length === 0) {
        return;
    }
    const ids = new Set(requestIDs);
    const transactionIDs = new Set(state.edits.filter((edit) => ids.has(edit.requestID)).map((edit) => edit.transactionID));
    state.edits = state.edits.filter((edit) => !ids.has(edit.requestID));
    for (const requestID of ids) {
        locallyAcknowledgedRequestIDs.delete(requestID);
    }
    for (const transactionID of transactionIDs) {
        if (!state.edits.some((edit) => edit.transactionID === transactionID)) {
            delete state.confirmed[transactionID];
        }
    }
    freshnessGeneration += 1;
    persist();
}

function transferTransactionEditOwnership(fromRequestID: string | undefined, toRequestID: string | undefined) {
    if (!fromRequestID || !toRequestID || fromRequestID === toRequestID) {
        return;
    }
    for (const edit of state.edits) {
        if (edit.requestID === fromRequestID) {
            edit.requestID = toRequestID;
        }
    }
    persist();
}

function getFreshnessGeneration() {
    return freshnessGeneration;
}

export {
    discardTransactionEdits,
    finalizeTransactionEdits,
    getFreshnessGeneration,
    getTransactionEditPersistencePromise,
    protectTransactionLifecycleUpdates,
    protectTransactionUpdates,
    registerTransactionEdits,
    transferTransactionEditOwnership,
};
