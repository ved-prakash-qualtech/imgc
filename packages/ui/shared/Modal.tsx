type ModalProps = Readonly<{
  title: string;
  children: React.ReactNode;
}>;

export function Modal({ title, children }: ModalProps) {
  return (
    <dialog
      open
      aria-labelledby="modal-title"
      className="m-0 rounded-lg border border-border bg-surface p-4 shadow-lg"
    >
      <h2 id="modal-title" className="text-body font-semibold text-foreground">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}
