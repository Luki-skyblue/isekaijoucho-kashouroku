import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

function formatTarget(targetType: string | null, targetId: number | null) {
  if (targetType === "song" && targetId) {
    return `song:${targetId}`;
  }

  return targetType ?? "-";
}

export default async function ManageSubmissionsPage() {
  const { data: submissions, error } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/_manage"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO MANAGE
        </Link>

        <section className="mt-8 border border-black/15 p-5">
          <p className="section-label text-black/45">ERROR</p>
          <p className="mt-3 text-sm leading-7 text-black/65">
            情報提供の取得に失敗しました。
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section className="border-b border-black/15 pb-8">
        <Link
          href="/_manage"
          className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
        >
          BACK TO MANAGE
        </Link>

        <p className="section-label mt-8 text-black/45">SUBMISSIONS</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          情報提供
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          フォームから送信された情報提供・修正提案を新しい順に表示します。
        </p>
      </section>

      <section className="mt-8">
        <p className="mb-4 text-xs text-black/45">
          {submissions?.length ?? 0} ITEMS
        </p>

        <div className="divide-y divide-black/10 border-y border-black/15">
          {submissions?.map((item) => (
            <article key={item.id} className="py-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="section-label text-black">
                  #{item.id}
                </p>

                <p className="text-xs text-black/45">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString("ja-JP")
                    : "-"}
                </p>

                <p className="border border-black/15 px-2 py-1 text-[11px] tracking-[0.08em] text-black/50">
                  {item.status ?? "new"}
                </p>

                <p className="border border-black/15 px-2 py-1 text-[11px] tracking-[0.08em] text-black/50">
                  {item.submission_type ?? "-"}
                </p>

                <p className="border border-black/15 px-2 py-1 text-[11px] tracking-[0.08em] text-black/50">
                  {formatTarget(item.target_type, item.target_id)}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[140px_1fr]">
                <p className="section-label text-black/45">PROPOSAL</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-black/75">
                  {item.proposed_value || "-"}
                </p>

                <p className="section-label text-black/45">SOURCE</p>
                <p className="break-all text-sm leading-7 text-black/60">
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 transition hover:text-black"
                    >
                      {item.source_url}
                    </a>
                  ) : (
                    "-"
                  )}
                </p>

                <p className="section-label text-black/45">COMMENT</p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-black/60">
                  {item.comment || "-"}
                </p>

                <p className="section-label text-black/45">CONTACT</p>
                <p className="break-all text-sm leading-7 text-black/60">
                  {item.contact || "-"}
                </p>
              </div>
            </article>
          ))}

          {(!submissions || submissions.length === 0) && (
            <p className="py-10 text-sm text-black/45">
              情報提供はまだありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}