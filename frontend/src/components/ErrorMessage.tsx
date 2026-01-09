import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface ErrorMessageProps {
  message: string;
  visible?: boolean;
  style?: any;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, visible = true, style }) => {
  if (!visible || !message) return null;

  return (
    <View style={[styles.container, style]}>
      <Ionicons name="alert-circle" size={20} color={Colors.error} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee',
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  text: {
    ...Typography.body,
    color: Colors.error,
    flex: 1,
    fontWeight: '600',
  },
});
