import ONYXKEYS from '@src/ONYXKEYS';
import {hasCompanyCardFeedSelector} from '@src/selectors/Card';

import useOnyx from './useOnyx';

/**
 * Returns whether a domain group can use a card feed's preferred workspace.
 *
 * Expensify Card settings are stored against the domain account ID. Company-card
 * feeds are different: they are stored against their workspace account IDs. Read
 * the company-card collection instead of constructing that key from the domain ID.
 */
function useDomainCardFeedEligibility(domainAccountID: number) {
    const [domainCardSettings, domainCardSettingsResult] = useOnyx(`${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${domainAccountID}`);
    const [hasCompanyCardFeed, companyCardFeedsResult] = useOnyx(ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER, {
        selector: (cardFeedsCollection) => Object.values(cardFeedsCollection ?? {}).some((cardFeeds) => hasCompanyCardFeedSelector(cardFeeds ?? undefined)),
    });

    const hasEligibleCardFeed = !!domainCardSettings || !!hasCompanyCardFeed;
    const isLoading = !hasEligibleCardFeed && (domainCardSettingsResult.status === 'loading' || companyCardFeedsResult.status === 'loading');

    return {hasEligibleCardFeed, isLoading};
}

export default useDomainCardFeedEligibility;
