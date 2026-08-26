import {act, renderHook, waitFor} from '@testing-library/react-native';

import useDomainCardFeedEligibility from '@hooks/useDomainCardFeedEligibility';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

const CURRENT_DOMAIN_ACCOUNT_ID = 1001;
const OTHER_DOMAIN_ACCOUNT_ID = 1002;
const OTHER_WORKSPACE_ACCOUNT_ID = 2002;
const OTHER_WORKSPACE_CARD_FEEDS_KEY = `${ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER}${OTHER_WORKSPACE_ACCOUNT_ID}` as const;

describe('useDomainCardFeedEligibility cross-domain scoping', () => {
    beforeEach(async () => {
        await Onyx.clear();
    });

    test('does not enable the current domain for a company-card feed belonging to another domain', async () => {
        const {result} = renderHook(() => useDomainCardFeedEligibility(CURRENT_DOMAIN_ACCOUNT_ID));

        await act(async () => {
            await Onyx.merge(OTHER_WORKSPACE_CARD_FEEDS_KEY, {
                settings: {
                    companyCards: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.MOCK_BANK]: {
                            domainID: OTHER_DOMAIN_ACCOUNT_ID,
                            preferredPolicy: 'OTHER_DOMAIN_POLICY_ID',
                            linkedPolicyIDs: ['OTHER_DOMAIN_POLICY_ID'],
                            pending: false,
                        },
                    },
                    companyCardNicknames: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.MOCK_BANK]: 'Other Domain Mock Bank',
                    },
                },
            });
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.hasEligibleCardFeed).toBe(false);
    });

    test('enables the current domain for a company-card feed stored under a different workspace account ID', async () => {
        const {result} = renderHook(() => useDomainCardFeedEligibility(CURRENT_DOMAIN_ACCOUNT_ID));

        await act(async () => {
            await Onyx.merge(OTHER_WORKSPACE_CARD_FEEDS_KEY, {
                settings: {
                    companyCards: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.MOCK_BANK]: {
                            domainID: CURRENT_DOMAIN_ACCOUNT_ID,
                            preferredPolicy: 'CURRENT_DOMAIN_POLICY_ID',
                            linkedPolicyIDs: ['CURRENT_DOMAIN_POLICY_ID'],
                            pending: false,
                        },
                    },
                    companyCardNicknames: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.MOCK_BANK]: 'Current Domain Mock Bank',
                    },
                },
            });
        });

        await waitFor(() => {
            expect(result.current.hasEligibleCardFeed).toBe(true);
        });
    });
});
