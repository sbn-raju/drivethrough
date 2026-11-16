import type { ReactNode } from 'react';
import { Button, Spinner } from '@heroui/react';

/** Button that shows a spinner and blocks duplicate submissions while pending (design.md §7). */
export function PendingButton({ pending, children, pendingLabel, onPress, type = 'button', variant = 'primary', isDisabled, className }: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  onPress?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost';
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <Button type={type} variant={variant} size="lg" isPending={pending} isDisabled={isDisabled} onPress={onPress} className={className}>
      {({ isPending }) => (
        <>
          {isPending ? <Spinner color="current" size="sm" /> : null}
          {isPending && pendingLabel ? pendingLabel : children}
        </>
      )}
    </Button>
  );
}
