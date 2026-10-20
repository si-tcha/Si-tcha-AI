import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

/**
 * Keeps transparent form modals stable while the Android keyboard opens/closes.
 * Android already resizes the modal window; wrapping it in KeyboardAvoidingView
 * can make those two layout systems fight and visibly oscillate.
 */
export function ModalKeyboardContainer({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={{ flex: 1 }}>{children}</View>;
}
