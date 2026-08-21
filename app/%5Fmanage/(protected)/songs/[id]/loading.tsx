export default function ManageSongTabLoading() {
  return (
    <section className="mt-10 animate-pulse" aria-label="タブ内容を読み込み中">
      <div className="h-3 w-24 bg-black/10" />
      <div className="mt-3 h-8 w-48 bg-black/10" />
      <div className="mt-6 space-y-3 border-t border-black/10 pt-4">
        <div className="h-12 bg-black/[0.04]" />
        <div className="h-12 bg-black/[0.04]" />
        <div className="h-12 bg-black/[0.04]" />
      </div>
    </section>
  );
}
