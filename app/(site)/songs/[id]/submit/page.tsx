import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SongSubmitPage({ params }: PageProps) {
  const { id } = await params;

  const { data: song, error } = await supabase
    .from("songs")
    .select("id,title")
    .eq("id", id)
    .single();

  if (error || !song) {
    notFound();
  }

  const songId = song.id;
  const songTitle = song.title;

  async function submitForm(formData: FormData) {
    "use server";

    const proposedValue = String(formData.get("proposed_value") ?? "").trim();
    const sourceUrl = String(formData.get("source_url") ?? "").trim();
    const comment = String(formData.get("comment") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();

    if (!proposedValue) {
      return;
    }

    const { error: insertError } = await supabase.from("submissions").insert({
      target_type: "song",
      target_id: songId,
      submission_type: "correction",
      proposed_value: proposedValue,
      source_url: sourceUrl || null,
      comment: comment || null,
      contact: contact || null,
      status: "new",
    });

    if (insertError) {
      throw new Error("情報提供の送信に失敗しました。");
    }

    redirect(`/submit/thanks?songId=${songId}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/songs/${songId}`}
        className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
      >
        BACK TO SONG
      </Link>

      <section className="mt-8 border-b border-black/15 pb-8">
        <p className="section-label text-black/45">SUBMIT INFO</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          情報提供・修正提案
        </h1>

        <p className="mt-5 text-sm leading-7 text-black/60">
          「{songTitle}」について、情報の追加・修正・出典URLなどがあれば送信してください。
          送信内容は確認後に反映します。
        </p>
      </section>

      <form action={submitForm} className="mt-8 space-y-6">
        <label className="block">
          <span className="section-label text-black/60">PROPOSAL</span>
          <textarea
            name="proposed_value"
            required
            rows={6}
            placeholder="修正・追加したい内容を書いてください"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <label className="block">
          <span className="section-label text-black/60">SOURCE URL</span>
          <input
            name="source_url"
            type="url"
            placeholder="出典URLがあれば入力"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <label className="block">
          <span className="section-label text-black/60">COMMENT</span>
          <textarea
            name="comment"
            rows={4}
            placeholder="補足があれば入力"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <label className="block">
          <span className="section-label text-black/60">CONTACT</span>
          <input
            name="contact"
            placeholder="連絡先 任意"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <div className="border-t border-black/15 pt-6">
          <button
            type="submit"
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            SEND
          </button>
        </div>
      </form>
    </main>
  );
}