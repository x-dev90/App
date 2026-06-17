import React from 'react';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption} from '@components/ButtonWithDropdownMenu/types';
import {ModalActions} from '@components/Modal/Global/ModalContext';
import {useTableContext} from '@components/Table/TableContext';
import useConfirmModal from '@hooks/useConfirmModal';
import useLocalize from '@hooks/useLocalize';
import {navigateToCardsTransactions} from '@libs/CardNavigationUtils';
import downloadCompanyCardsCSV from '@libs/CompanyCardCSVUtils';
import {unassignWorkspaceCompanyCard} from '@userActions/CompanyCards';
import type {CompanyCardFeedWithNumber} from '@src/types/onyx/CardFeeds';
import type {WorkspaceCompanyCardTableItemData} from './WorkspaceCompanyCardsTableRow';

type WorkspaceCompanyCardsBulkActionsProps = {
    policyID: string;
    domainOrWorkspaceAccountID: number;
    bankName?: CompanyCardFeedWithNumber;
};

function WorkspaceCompanyCardsBulkActions({policyID, domainOrWorkspaceAccountID, bankName}: WorkspaceCompanyCardsBulkActionsProps) {
    const {translate} = useLocalize();
    const {showConfirmModal} = useConfirmModal();
    const {processedData, tableMethods} = useTableContext<WorkspaceCompanyCardTableItemData>();
    const selectedCards = processedData.filter((card) => card.selected);
    const assignedCards = selectedCards.filter((card) => card.isAssigned && !!card.assignedCard?.cardID);
    const canUseAssignedActions = !!bankName && selectedCards.length > 0 && assignedCards.length === selectedCards.length;

    if (selectedCards.length === 0) {
        return null;
    }

    const options: Array<DropdownOption<string>> = [
        ...(canUseAssignedActions
            ? [
                  {
                      value: 'unassign',
                      text: translate('workspace.companyCards.unassignCards'),
                      onSelected: async () => {
                          const result = await showConfirmModal({
                              title: translate('workspace.companyCards.unassignCards'),
                              prompt: translate('workspace.companyCards.unassignCardsDescription'),
                              confirmText: translate('workspace.moreFeatures.companyCards.unassign'),
                              danger: true,
                              shouldShowCancelButton: true,
                          });

                          if (result.action !== ModalActions.CONFIRM) {
                              return;
                          }

                          for (const card of assignedCards) {
                              if (!card.assignedCard || !bankName) {
                                  continue;
                              }
                              unassignWorkspaceCompanyCard(domainOrWorkspaceAccountID, bankName, card.assignedCard);
                          }
                          tableMethods.clearSelection();
                      },
                  },
                  {
                      value: 'viewTransactions',
                      text: translate('workspace.companyCards.viewTransactions'),
                      onSelected: () => navigateToCardsTransactions(assignedCards.map((card) => String(card.assignedCard?.cardID)).filter(Boolean)),
                  },
              ]
            : []),
        {
            value: 'exportCSV',
            text: translate('workspace.expensifyCard.exportAsCSV'),
            onSelected: () => downloadCompanyCardsCSV({policyID, cards: selectedCards, translate}),
        },
    ];

    return (
        <ButtonWithDropdownMenu<string>
            success
            customText={translate('workspace.common.selected', {count: selectedCards.length})}
            options={options}
            shouldAlwaysShowDropdownMenu
            isSplitButton={false}
            onPress={() => {}}
            style={{alignSelf: 'flex-start'}}
        />
    );
}

export default WorkspaceCompanyCardsBulkActions;
