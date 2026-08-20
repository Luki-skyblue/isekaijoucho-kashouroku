type PreparationPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function PreparationPage({
  eyebrow,
  title,
  description,
  children,
}: PreparationPageProps) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <header className="max-w-2xl border-b border-black/15 pb-10">
        <p className="section-label text-black/45">{eyebrow}</p>
        <h1 className="font-serif-jp mt-5 text-3xl font-medium tracking-[0.03em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-5 inline-flex border border-black/30 px-3 py-1.5 text-xs tracking-[0.12em] text-black/60">
          準備中
        </p>
        <p className="mt-6 text-sm leading-8 text-black/60">{description}</p>
      </header>
      <div className="mt-10">{children}</div>
    </main>
  );
}
