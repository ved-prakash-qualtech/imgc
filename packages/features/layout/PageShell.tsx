type PageShellProps = Readonly<{
  title: string;
  children: React.ReactNode;
}>;

export function PageShell({ title, children }: PageShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="font-display text-heading font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {children}
    </div>
  );
}
