"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ManageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="border border-red-900/20 bg-red-900/[0.02] p-6 sm:p-8">
        <p className="section-label text-red-900/55">SAVE ERROR</p>
        <h1 className="font-serif-jp mt-4 text-2xl font-medium text-black sm:text-3xl">
          保存できませんでした
        </h1>
        <p className="mt-5 text-sm leading-8 text-black/60">
          入力内容は保存されていない可能性があります。入力値を確認して、もう一度試してください。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="border border-black bg-black px-4 py-2 text-xs font-medium tracking-[0.12em] text-[#f5f5f2] transition hover:bg-black/80"
          >
            もう一度試す
          </button>
          <Link
            href="/_manage"
            className="border border-black/25 px-4 py-2 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:text-black"
          >
            管理ホームへ戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
