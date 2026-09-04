type BadgeProps = Readonly<{
  children: React.ReactNode;
}>;

export function Badge({ children }: BadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-body text-muted">
      {children}
    </span>
  );
}
