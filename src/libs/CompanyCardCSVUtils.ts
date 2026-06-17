import type {LocalizedTranslate} from '@components/LocaleContextProvider';
import type {WorkspaceCompanyCardTableItemData} from '@components/Tables/WorkspaceCompanyCardsTable/WorkspaceCompanyCardsTableRow';
import localFileDownload from './localFileDownload';

function escapeCsvField(value: string): string {
    return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

type DownloadCompanyCardsCSVParams = {
    policyID: string;
    cards: WorkspaceCompanyCardTableItemData[];
    translate: LocalizedTranslate;
};

export default function downloadCompanyCardsCSV({policyID, cards, translate}: DownloadCompanyCardsCSVParams) {
    if (cards.length === 0) {
        return;
    }

    const header = [
        translate('common.email'),
        translate('common.name'),
        translate('workspace.moreFeatures.companyCards.cardNumber'),
        translate('workspace.moreFeatures.companyCards.transactionStartDate'),
        translate('workspace.moreFeatures.companyCards.lastUpdated'),
        translate('workspace.moreFeatures.companyCards.assignedCards'),
    ]
        .map(escapeCsvField)
        .join(',');

    const rows = cards.map((card) =>
        [
            card.isAssigned ? (card.cardholder?.login ?? '') : translate('workspace.moreFeatures.companyCards.unassignedCards'),
            card.isAssigned ? (card.cardholder?.displayName ?? '') : '',
            card.cardName,
            card.isAssigned ? (card.assignedCard?.scrapeMinDate ?? '') : '',
            card.isAssigned ? String(card.assignedCard?.lastScrape ?? '') : '',
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
