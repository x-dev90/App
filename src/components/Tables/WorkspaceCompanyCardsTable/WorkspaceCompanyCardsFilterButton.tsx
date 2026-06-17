import React from 'react';
import DropdownButton from '@components/Search/FilterDropdowns/DropdownButton';
import {useTableContext} from '@components/Table/TableContext';
import buildFilterItems from '@components/Table/TableFilterButtons/buildFilterItems';
import useLocalize from '@hooks/useLocalize';

function WorkspaceCompanyCardsFilterButton() {
    const {translate} = useLocalize();
    const {
        filterConfig,
        activeFilters,
        tableMethods: {updateFilter},
    } = useTableContext();

    const filterItems = buildFilterItems(
        filterConfig,
        activeFilters,
        (key, value) => {
            updateFilter({key, value});
        },
        translate('search.filtersHeader'),
    );

    const filterItem = filterItems.at(0);

    if (!filterItem) {
        return null;
    }

    return (
        <DropdownButton
            label={translate('search.filtersHeader')}
            value={null}
            medium
            PopoverComponent={filterItem.PopoverComponent}
        />
    );
}

export default WorkspaceCompanyCardsFilterButton;
