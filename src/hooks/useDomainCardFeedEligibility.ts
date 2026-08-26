import {getOriginalCompanyFeeds} from '@libs/CardUtils';

import ONYXKEYS from '@src/ONYXKEYS';

import useOnyx from './useOnyx';

/**
 * Returns whether a domain group can use a card feed's preferred workspace.
 *
 * Expensify Card settings are stored against the domain account ID. Company-card
 * feeds can be stored against workspace account IDs, so their collection entry key
 * cannot be used to determine the owning domain. The feed's domainID provides that
 * relationship.
 */
function useDomainCardFeedEligibility(domainAccountID: number) {
    const [domainCardSettings, domainCardSettingsResult] = useOnyx(`${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${domainAccountID}`);
    const [hasCompanyCardFeed, companyCardFeedsResult] = useOnyx(ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER, {
        selector: (cardFeedsCollection) =>
            Object.values(cardFeedsCollection ?? {}).some((cardFeeds) =>
                Object.values(getOriginalCompanyFeeds(cardFeeds ?? undefined)).some((cardFeed) => cardFeed?.domainID === domainAccountID),
            ),
    });

    const hasEligibleCardFeed = !!domainCardSettings || !!hasCompanyCardFeed;
    const isLoading = !hasEligibleCardFeed && (domainCardSettingsResult.status === 'loading' || companyCardFeedsResult.status === 'loading');

    return {hasEligibleCardFeed, isLoading};
}

export default useDomainCardFeedEligibility;
