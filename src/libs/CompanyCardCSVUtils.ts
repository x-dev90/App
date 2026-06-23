import {format, parseISO} from 'date-fns';
import type {LocalizedTranslate} from '@components/LocaleContextProvider';
import type {WorkspaceCompanyCardTableItemData} from '@components/Tables/WorkspaceCompanyCardsTable/WorkspaceCompanyCardsTableRow';
import CONST from '@src/CONST';
import {maskCardNumber} from './CardUtils';
import localFileDownload from './localFileDownload';

function escapeCsvField(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

type DownloadCompanyCardsCSVParams = {
    policyID: string;
    cards: WorkspaceCompanyCardTableItemData[];
    translate: LocalizedTranslate;
    getLocalDateFromDatetime: (datetime?: string) => Date;
    bankName?: string;
};

export default function downloadCompanyCardsCSV({policyID, cards, translate, getLocalDateFromDatetime, bankName}: DownloadCompanyCardsCSVParams) {
    if (cards.length === 0) {
        return;
    }

    const header = [
        translate('common.email'),
        translate('workspace.expensifyCard.name'),
        translate('workspace.moreFeatures.companyCards.cardNumber'),
        translate('workspace.moreFeatures.companyCards.transactionStartDate'),
        translate('workspace.moreFeatures.companyCards.lastUpdated'),
        translate('workspace.moreFeatures.companyCards.assignedCards'),
    ]
        .map(escapeCsvField)
        .join(',');

    const rows = cards.map((card) =>
        [
            card.isAssigned ? (card.cardholder?.login ?? '') : 'unassigned',
            card.isAssigned ? (card.cardholder?.displayName ?? '') : '',
            maskCardNumber(card.cardName, bankName, true),
            card.isAssigned && card.assignedCard?.scrapeMinDate ? format(parseISO(card.assignedCard.scrapeMinDate), CONST.DATE.FNS_FORMAT_STRING) : '',
            card.isAssigned && card.assignedCard?.lastScrape ? format(getLocalDateFromDatetime(card.assignedCard.lastScrape), CONST.DATE.FNS_DATE_TIME_FORMAT_STRING) : '',
            card.isAssigned ? translate('common.yes') : translate('common.no'),
        ]
            .map((value) => escapeCsvField(String(value)))
            .join(','),
    );

    const csvContent = [header, ...rows].join('\r\n');
    const safePolicySegment = policyID.replaceAll(/[^\dA-Za-z-_]/g, '') || 'workspace';
    const fileName = `CompanyCards_${safePolicySegment}.csv`;
    localFileDownload(fileName, csvContent, translate);
}
