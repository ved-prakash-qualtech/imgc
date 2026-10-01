type SidebarProps = Readonly<{
  children?: React.ReactNode;
}>;

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-surface lg:block">
      <div className="p-4 text-body text-muted">{children ?? "Sidebar"}</div>
    </aside>
  );
}
