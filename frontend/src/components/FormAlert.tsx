import { Alert } from '@heroui/react';

export function FormAlert({ title, message, status = 'danger' }: { title?: string; message?: string | null; status?: 'danger' | 'success' | 'warning' | 'accent' }) {
  if (!message) return null;
  return (
    <Alert status={status} role={status === 'danger' ? 'alert' : 'status'}>
      <Alert.Indicator />
      <Alert.Content>
        {title ? <Alert.Title>{title}</Alert.Title> : null}
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
