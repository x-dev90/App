import React from 'react';
import TextWithIconCell from '@components/Search/SearchList/ListItem/TextWithIconCell';
import TextWithTooltip from '@components/TextWithTooltip';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import {getTagGLCodeForDisplay} from '@libs/PolicyUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type TransactionDataCellProps from './TransactionDataCellProps';

type TagGLCodeCellProps = TransactionDataCellProps & {
    policyID?: string;
};

function TagGLCodeCell({shouldUseNarrowLayout, shouldShowTooltip, transactionItem, policyID}: TagGLCodeCellProps) {
    const icons = useMemoizedLazyExpensifyIcons(['Tag']);
    const styles = useThemeStyles();
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyID}`);
    const tagGLCodeForDisplay = getTagGLCodeForDisplay(transactionItem, policyTags);

    if (shouldUseNarrowLayout) {
        return (
            <TextWithIconCell
                icon={icons.Tag}
                showTooltip={shouldShowTooltip}
                text={tagGLCodeForDisplay}
                textStyle={[styles.textMicro, styles.mnh0]}
            />
        );
    }

    return (
        <TextWithTooltip
            shouldShowTooltip={shouldShowTooltip}
            text={tagGLCodeForDisplay}
            numberOfLines={1}
            style={[styles.lineHeightLarge, styles.justifyContentCenter]}
        />
    );
}

export default TagGLCodeCell;
