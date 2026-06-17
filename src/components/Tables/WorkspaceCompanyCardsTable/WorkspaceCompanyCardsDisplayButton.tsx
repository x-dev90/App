import React, {useMemo, useState} from 'react';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import ScrollView from '@components/ScrollView';
import type {SingleSelectItem} from '@components/Search/FilterComponents/SingleSelect';
import BasePopup from '@components/Search/FilterDropdowns/BasePopup';
import DropdownButton from '@components/Search/FilterDropdowns/DropdownButton';
import type {PopoverComponentProps} from '@components/Search/FilterDropdowns/FilterPopupButton';
import SelectionList from '@components/SelectionList';
import SingleSelectListItem from '@components/SelectionList/ListItem/SingleSelectListItem';
import {useTableContext} from '@components/Table/TableContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

type DisplaySortFilter = 'sortBy' | 'sortOrder' | null;

function WorkspaceCompanyCardsDisplayPopup({closeOverlay}: PopoverComponentProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const {columns, activeSorting, tableMethods} = useTableContext();
    const sortableColumns = useMemo(
        () =>
            columns
                .filter((column) => column.sortable)
                .map(
                    (column): SingleSelectItem<string> => ({
                        text: column.label,
                        value: column.key,
                    }),
                ),
        [columns],
    );
    const [selectedDisplayFilter, setSelectedDisplayFilter] = useState<DisplaySortFilter>(null);
    const [draftSorting, setDraftSorting] = useState(activeSorting);

    const sortByOptions = sortableColumns.map((column) => ({
        keyForList: column.value,
        text: column.text,
        isSelected: draftSorting.columnKey === column.value,
    }));

    const selectedSortBy = sortByOptions.find((option) => option.keyForList === activeSorting.columnKey)?.text ?? sortByOptions.at(0)?.text ?? '';

    const applyDraftSorting = () => {
        tableMethods.updateSorting(draftSorting);
        closeOverlay();
    };

    const resetDraftSorting = () => {
        const defaultSortColumn = sortableColumns.at(0)?.value;
        if (!defaultSortColumn) {
            closeOverlay();
            return;
        }
        tableMethods.updateSorting({columnKey: defaultSortColumn, order: 'asc'});
        closeOverlay();
    };

    if (selectedDisplayFilter === 'sortOrder') {
        const sortOrderItems = [
            {
                keyForList: 'asc',
                text: translate('search.filters.sortOrder.asc'),
                isSelected: draftSorting.order === 'asc',
            },
            {
                keyForList: 'desc',
                text: translate('search.filters.sortOrder.desc'),
                isSelected: draftSorting.order === 'desc',
            },
        ];

        return (
            <BasePopup
                label={translate('search.display.sortBy')}
                onBackButtonPress={() => setSelectedDisplayFilter('sortBy')}
                onApply={applyDraftSorting}
                onReset={resetDraftSorting}
                applySentryLabel={CONST.SENTRY_LABEL.SEARCH.FILTER_POPUP_APPLY_SINGLE_SELECT}
                resetSentryLabel={CONST.SENTRY_LABEL.SEARCH.FILTER_POPUP_RESET_SINGLE_SELECT}
            >
                <SelectionList
                    data={sortOrderItems}
                    ListItem={SingleSelectListItem}
                    shouldSingleExecuteRowSelect
                    onSelectRow={(item) => {
                        setDraftSorting((currentSorting) => ({...currentSorting, order: item.keyForList as 'asc' | 'desc'}));
                    }}
                    style={{contentContainerStyle: [styles.pb0, styles.pv3]}}
                />
            </BasePopup>
        );
    }

    if (selectedDisplayFilter === 'sortBy') {
        return (
            <BasePopup
                label={translate('search.display.sortBy')}
                onBackButtonPress={() => setSelectedDisplayFilter(null)}
                onApply={applyDraftSorting}
                onReset={resetDraftSorting}
                applySentryLabel={CONST.SENTRY_LABEL.SEARCH.FILTER_POPUP_APPLY_SINGLE_SELECT}
                resetSentryLabel={CONST.SENTRY_LABEL.SEARCH.FILTER_POPUP_RESET_SINGLE_SELECT}
            >
                <ScrollView contentContainerStyle={[styles.pb0]}>
                    <MenuItemWithTopDescription
                        shouldShowRightIcon
                        description={translate('search.display.sortOrder')}
                        title={translate(`search.filters.sortOrder.${draftSorting.order}`)}
                        onPress={() => setSelectedDisplayFilter('sortOrder')}
                    />
                    <SelectionList
                        data={sortByOptions}
                        ListItem={SingleSelectListItem}
                        shouldSingleExecuteRowSelect
                        onSelectRow={(item) => {
                            setDraftSorting((currentSorting) => ({...currentSorting, columnKey: item.keyForList}));
                        }}
                        style={{contentContainerStyle: [styles.pb0]}}
                    />
                </ScrollView>
            </BasePopup>
        );
    }

    return (
        <ScrollView contentContainerStyle={[styles.pv4]}>
            <MenuItemWithTopDescription
                shouldShowRightIcon
                description={translate('search.display.sortBy')}
                title={`${selectedSortBy} ${CONST.DOT_SEPARATOR} ${translate(`search.filters.sortOrder.${activeSorting.order}`)}`}
                onPress={() => setSelectedDisplayFilter('sortBy')}
                sentryLabel={CONST.SENTRY_LABEL.SEARCH.FILTER_SORT_BY}
            />
        </ScrollView>
    );
}

function WorkspaceCompanyCardsDisplayButton() {
    const {translate} = useLocalize();

    return (
        <DropdownButton
            label={translate('search.display.label')}
            value={null}
            medium
            PopoverComponent={(props) => <WorkspaceCompanyCardsDisplayPopup {...props} />}
        />
    );
}

export default WorkspaceCompanyCardsDisplayButton;
