const fetchedPoliciesBySessionKey = new Map<string, Set<string>>();

function getSessionKey(sessionCreationDate: number | undefined): string {
    return sessionCreationDate?.toString() ?? 'unknown';
}

function hasFetchedCompanyCards(sessionCreationDate: number | undefined, policyID: string): boolean {
    return fetchedPoliciesBySessionKey.get(getSessionKey(sessionCreationDate))?.has(policyID) ?? false;
}

function markCompanyCardsAsFetched(sessionCreationDate: number | undefined, policyID: string): void {
    const sessionKey = getSessionKey(sessionCreationDate);
    const fetchedPolicies = fetchedPoliciesBySessionKey.get(sessionKey) ?? new Set<string>();
    fetchedPolicies.add(policyID);
    fetchedPoliciesBySessionKey.set(sessionKey, fetchedPolicies);
}

export {hasFetchedCompanyCards, markCompanyCardsAsFetched};
