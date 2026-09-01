import React, { createContext, useContext, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Animated, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions | string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  const showToast = useCallback((options: ToastOptions | string) => {
    const message = typeof options === 'string' ? options : options.message;
    const type = typeof options === 'string' ? 'info' : (options.type || 'info');
    const duration = typeof options === 'string' ? 3000 : (options.duration || 3000);

    setToast({ message, type });

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.delay(duration),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [fadeAnim]);

  const getIconName = (type: ToastType): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      case 'warning':
        return 'alert-triangle';
      default:
        return 'info';
    }
  };

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return '#14532d';
      case 'error':
        return '#7f1d1d';
      case 'warning':
        return '#7c2d12';
      default:
        return '#101e0f';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            { backgroundColor: getBgColor(toast.type), opacity: fadeAnim },
          ]}
        >
          <Feather name={getIconName(toast.type)} size={18} color="#f3ecd8" style={styles.icon} />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback simple if context not available
    return {
      showToast: (options: ToastOptions | string) => {
        const msg = typeof options === 'string' ? options : options.message;
        console.log('[Toast]:', msg);
      },
    };
  }
  return context;
};
export default useToast;

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 20,
    right: 20,
    maxWidth: 400,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  icon: {
    marginRight: 10,
  },
  toastText: {
    color: '#f3ecd8',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});
