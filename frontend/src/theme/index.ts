// Design System 2025 - Accademia de "I Musici"

export const Colors = {
  // Primary
  primary: '#1E40AF',
  primaryLight: '#3B82F6',
  primaryDark: '#1E3A8A',
  
  // Accent
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  
  // Feedback
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  
  // Neutral
  background: '#F8FAFC',
  surface: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  disabled: '#D1D5DB',
  
  // Role Colors
  admin: '#1E40AF',
  teacher: '#F59E0B',
  student: '#10B981',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

export const Typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
  fontSize: {
    h1: 28,
    h2: 22,
    h3: 18,
    body: 16,
    caption: 14,
    small: 12,
    tiny: 10,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const Animation = {
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
};

export const Layout = {
  touchableMinHeight: 44,
  buttonHeight: 48,
  inputHeight: 48,
  headerHeight: 56,
  tabBarHeight: 64,
  borderWidth: 1,
  iconSize: {
    small: 16,
    medium: 20,
    large: 24,
    xlarge: 32,
  },
};

// Helper function to create gradients
export const Gradients = {
  primary: ['#1E40AF', '#3B82F6'],
  accent: ['#F59E0B', '#FCD34D'],
  success: ['#10B981', '#34D399'],
  error: ['#EF4444', '#F87171'],
};

// Common component styles
export const CommonStyles = {
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.medium,
  },
  button: {
    height: Layout.buttonHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  input: {
    height: Layout.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: Layout.borderWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Animation,
  Layout,
  Gradients,
  CommonStyles,
};
