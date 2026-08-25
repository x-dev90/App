import {act, renderHook, waitFor} from '@testing-library/react-native';

import useDomainCardFeedEligibility from '@hooks/useDomainCardFeedEligibility';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

const DOMAIN_ACCOUNT_ID = 12345;
const EXPENSIFY_CARD_SETTINGS_KEY = `${ONYXKEYS.COLLECTION.PRIVATE_EXPENSIFY_CARD_SETTINGS}${DOMAIN_ACCOUNT_ID}` as const;
const COMPANY_CARD_FEEDS_KEY = `${ONYXKEYS.COLLECTION.SHARED_NVP_PRIVATE_DOMAIN_MEMBER}${DOMAIN_ACCOUNT_ID}` as const;

describe('useDomainCardFeedEligibility', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await act(async () => Onyx.clear());
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await act(async () => Onyx.clear());
    });

    it('returns false when the domain has no card feed', async () => {
        const {result} = renderHook(() => useDomainCardFeedEligibility(DOMAIN_ACCOUNT_ID));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.hasEligibleCardFeed).toBe(false);
    });

    it('returns true for an Expensify Card feed', async () => {
        await act(async () => Onyx.merge(EXPENSIFY_CARD_SETTINGS_KEY, {isEnabled: true}));

        const {result} = renderHook(() => useDomainCardFeedEligibility(DOMAIN_ACCOUNT_ID));

        await waitFor(() => expect(result.current.hasEligibleCardFeed).toBe(true));
    });

    it('returns true for a completed third-party company card feed', async () => {
        await act(async () =>
            Onyx.merge(COMPANY_CARD_FEEDS_KEY, {
                settings: {
                    companyCards: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.CSV]: {pending: false},
                    },
                },
            }),
        );

        const {result} = renderHook(() => useDomainCardFeedEligibility(DOMAIN_ACCOUNT_ID));

        await waitFor(() => expect(result.current.hasEligibleCardFeed).toBe(true));
    });

    it('reacts to optimistic feed deletion and rollback', async () => {
        await act(async () =>
            Onyx.merge(COMPANY_CARD_FEEDS_KEY, {
                settings: {
                    companyCards: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.CSV]: {pending: false},
                    },
                },
            }),
        );

        const {result} = renderHook(() => useDomainCardFeedEligibility(DOMAIN_ACCOUNT_ID));
        await waitFor(() => expect(result.current.hasEligibleCardFeed).toBe(true));

        await act(async () =>
            Onyx.merge(COMPANY_CARD_FEEDS_KEY, {
                settings: {
                    companyCards: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.CSV]: {pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE},
                    },
                },
            }),
        );
        await waitFor(() => expect(result.current.hasEligibleCardFeed).toBe(false));

        await act(async () =>
            Onyx.merge(COMPANY_CARD_FEEDS_KEY, {
                settings: {
                    companyCards: {
                        [CONST.COMPANY_CARD.FEED_BANK_NAME.CSV]: {pendingAction: null},
                    },
                },
            }),
        );
        await waitFor(() => expect(result.current.hasEligibleCardFeed).toBe(true));
    });
});
