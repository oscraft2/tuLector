export function ModalConfirm({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-[#e6e8eb] bg-[#f8f9fb] p-4" role="status">
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#4b5563]">{body}</p>
    </div>
  );
}
