import Link from "next/link";
import { logoutAdmin } from "../actions";

export default function ManageTopPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <p className="section-label text-black/45">MANAGE</p>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif-jp text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
              管理ページ
            </h1>

            <p className="mt-4 text-sm leading-7 text-black/55">
              投稿内容の確認、楽曲データの確認・編集を行うための管理ページです。
            </p>
          </div>

          <form action={logoutAdmin}>
            <button
              type="submit"
              className="border border-black/25 px-4 py-2 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
            >
              LOGOUT
            </button>
          </form>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/_manage/submissions"
          className="border border-black/15 p-5 transition hover:bg-black/[0.03]"
        >
          <p className="section-label text-black/45">SUBMISSIONS</p>
          <h2 className="font-serif-jp mt-3 text-2xl font-medium text-black">
            情報提供
          </h2>
          <p className="mt-3 text-sm leading-7 text-black/55">
            フォームから送信された情報提供・修正提案を確認します。
          </p>
        </Link>

        <Link
          href="/_manage/songs"
          className="border border-black/15 p-5 transition hover:bg-black/[0.03]"
        >
          <p className="section-label text-black/45">SONGS</p>
          <h2 className="font-serif-jp mt-3 text-2xl font-medium text-black">
            楽曲データ
          </h2>
          <p className="mt-3 text-sm leading-7 text-black/55">
            楽曲データの確認・編集を行います。編集機能は次の段階で追加します。
          </p>
        </Link>
      </section>
    </main>
  );
}