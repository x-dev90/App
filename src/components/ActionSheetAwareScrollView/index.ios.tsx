import {useIsFocused} from '@react-navigation/native';
import React from 'react';
import Reanimated, {useAnimatedStyle} from 'react-native-reanimated';

import type {ActionSheetAwareScrollViewProps, RenderActionSheetAwareScrollViewComponent} from './types';

import {Actions, ActionSheetAwareScrollViewProvider, useActionSheetAwareScrollViewActions, useActionSheetAwareScrollViewState} from './ActionSheetAwareScrollViewContext';
import useActionSheetAwareScrollViewRef from './useActionSheetAwareScrollViewRef';
import useActionSheetKeyboardSpacing from './useActionSheetKeyboardSpacing';
import usePreventScrollOnKeyboardInteraction from './usePreventScrollOnKeyboardInteraction';

function ActionSheetAwareScrollView({style, children, ref, ...restProps}: ActionSheetAwareScrollViewProps) {
    const {onRef, animatedRef} = useActionSheetAwareScrollViewRef(ref);

    // This list's only consumer (the report actions list) is always rendered inside a navigator screen. When that
    // screen is covered by an RHP it stays mounted but loses focus; its keyboard handlers must then stop reacting,
    // otherwise the covered list animates to a keyboard that belongs to the screen on top and the resulting layout
    // churn cancels the next press on the report. Gating the spacing worklet on focus keeps the covered list inert.
    const isFocused = useIsFocused();

    const spacing = useActionSheetKeyboardSpacing(animatedRef, isFocused);
    const animatedStyle = useAnimatedStyle(() => ({
        paddingTop: spacing.get(),
    }));

    usePreventScrollOnKeyboardInteraction({scrollViewRef: animatedRef});

    return (
        <Reanimated.ScrollView
            {...restProps}
            ref={onRef}
            style={[style, animatedStyle]}
        >
            {children}
        </Reanimated.ScrollView>
    );
}

/**
 * This function should be used as renderScrollComponent prop for FlatList
 * @param props - props that will be passed to the ScrollView from FlatList
 * @returns - ActionSheetAwareScrollView
 */
const renderScrollComponent: RenderActionSheetAwareScrollViewComponent = (props) => {
    return <ActionSheetAwareScrollView {...props} />;
};

export {renderScrollComponent, ActionSheetAwareScrollViewProvider, Actions, useActionSheetAwareScrollViewState, useActionSheetAwareScrollViewActions};
