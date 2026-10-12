import {isSelfDM} from '@libs/ReportUtils';
import {hasTransactionBeenRejected} from '@libs/TransactionUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import type {SplitExpense} from '@src/types/onyx/IOU';
import type {SearchResultDataType} from '@src/types/onyx/SearchResults';

import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';

type SplitSavePlan = {
    isReverseSplitOperation: boolean;
    isLastTransactionInReport: boolean;
    willExpenseReportBecomeEmpty: boolean;
    backRoute: string;
};

type GetSplitSavePlanParams = {
    splitExpenses: SplitExpense[];
    allChildTransactions: Array<OnyxEntry<OnyxTypes.Transaction>>;
    allTransactionsList: OnyxCollection<OnyxTypes.Transaction>;
    allReportsList: OnyxCollection<OnyxTypes.Report>;
    searchData: SearchResultDataType | undefined;
    transactionViolations: OnyxCollection<OnyxTypes.TransactionViolation[]>;
    expenseReport: OnyxEntry<OnyxTypes.Report>;
    originalTransactionID: string;
};

function isSplitEligibleForReverse(
    split: OnyxEntry<OnyxTypes.Transaction> | SplitExpense,
    allTransactionsList: OnyxCollection<OnyxTypes.Transaction>,
    allReportsList: OnyxCollection<OnyxTypes.Report>,
    searchData: SearchResultDataType | undefined,
    transactionViolations: OnyxCollection<OnyxTypes.TransactionViolation[]>,
): boolean {
    if (!split?.transactionID) {
        return false;
    }

    const transactionKey = `${ONYXKEYS.COLLECTION.TRANSACTION}${split.transactionID}` as const;
    const transaction = allTransactionsList?.[transactionKey] ?? searchData?.[transactionKey];
    if (!transaction || transaction.reportID === null || transaction.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        return false;
    }

    const violationsKey = `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${split.transactionID}` as const;
    if (hasTransactionBeenRejected(transactionViolations?.[violationsKey])) {
        return false;
    }

    const reportID = transaction.reportID ?? split.reportID;
    if (!reportID) {
        return false;
    }

    const reportKey = `${ONYXKEYS.COLLECTION.REPORT}${reportID}` as const;
    const report = allReportsList?.[reportKey] ?? searchData?.[reportKey];
    if (!report) {
        return false;
    }

    return isSelfDM(report) || report.statusNum === CONST.REPORT.STATUS_NUM.OPEN;
}

/**
 * Builds the one source of truth for split saving. A revert affects every linked child, so it is
 * allowed only when every child is known to be safe to revert.
 */
function getSplitSavePlan({
    splitExpenses,
    allChildTransactions,
    allTransactionsList,
    allReportsList,
    searchData,
    transactionViolations,
    expenseReport,
    originalTransactionID,
}: GetSplitSavePlanParams): SplitSavePlan {
    const isCreationOfSplits = allChildTransactions.length === 0;
    const splitGroup = [...splitExpenses, ...allChildTransactions];
    const canReverseSplit =
        splitExpenses.length === 1 &&
        allChildTransactions.length > 0 &&
        splitGroup.length > 0 &&
        splitGroup.every((split) => isSplitEligibleForReverse(split, allTransactionsList, allReportsList, searchData, transactionViolations));

    const expenseReportID = expenseReport?.reportID;
    const expenseReportTransactions = expenseReportID ? Object.values(allTransactionsList ?? {}).filter((transaction) => transaction?.reportID === expenseReportID) : [];
    const areAllExpenseReportTransactionsSplitChildren =
        expenseReportTransactions.length > 0 && expenseReportTransactions.every((transaction) => transaction?.comment?.originalTransactionID === originalTransactionID);
    const anyRemainingSplitStaysInExpenseReport = splitExpenses.some((split) => split.reportID === expenseReportID);
    const reverseSplitKeepsOriginalInExpenseReport = canReverseSplit && splitExpenses.at(0)?.reportID === expenseReportID;
    const willExpenseReportBecomeEmpty =
        !isCreationOfSplits && !!expenseReportID && areAllExpenseReportTransactionsSplitChildren && !anyRemainingSplitStaysInExpenseReport && !reverseSplitKeepsOriginalInExpenseReport;
    const isLastTransactionInReport = willExpenseReportBecomeEmpty || (canReverseSplit && !reverseSplitKeepsOriginalInExpenseReport && expenseReportTransactions.length === 1);
    const fallbackReportID = expenseReport?.chatReportID ?? expenseReport?.parentReportID;
    const fallbackReport = fallbackReportID
        ? (allReportsList?.[`${ONYXKEYS.COLLECTION.REPORT}${fallbackReportID}`] ?? searchData?.[`${ONYXKEYS.COLLECTION.REPORT}${fallbackReportID}`])
        : undefined;
    const backRoute = fallbackReportID && fallbackReport && expenseReport?.hasParentAccess !== false ? ROUTES.REPORT_WITH_ID.getRoute(fallbackReportID) : ROUTES.INBOX;

    return {
        isReverseSplitOperation: canReverseSplit,
        isLastTransactionInReport,
        willExpenseReportBecomeEmpty,
        backRoute,
    };
}

export {getSplitSavePlan};
export type {SplitSavePlan};
