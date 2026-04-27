import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function GeneralSubmitPage() {
  async function submitForm(formData: FormData) {
    "use server";

    const submissionType = String(
      formData.get("submission_type") ?? "other"
    ).trim();

    const proposedValue = String(formData.get("proposed_value") ?? "").trim();
    const sourceUrl = String(formData.get("source_url") ?? "").trim();
    const comment = String(formData.get("comment") ?? "").trim();
    const contact = String(formData.get("contact") ?? "").trim();

    if (!proposedValue) {
      return;
    }

    const { error } = await supabase.from("submissions").insert({
      target_type: "general",
      target_id: null,
      submission_type: submissionType,
      proposed_value: proposedValue,
      source_url: sourceUrl || null,
      comment: comment || null,
      contact: contact || null,
      status: "new",
    });

    if (error) {
      throw new Error("情報提供の送信に失敗しました。");
    }

    redirect("/submit/thanks");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
      >
        BACK TO TOP
      </Link>

      <section className="mt-8 border-b border-black/15 pb-8">
        <p className="archive-label text-black/45">SUBMIT</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          情報提供
        </h1>

        <p className="mt-5 text-sm leading-7 text-black/60">
          新規楽曲、ライブ歌唱情報、関連リンク、その他の修正・連絡はこちらから送信してください。
          送信内容は確認後に反映します。
        </p>
      </section>

      <form action={submitForm} className="mt-8 space-y-6">
        <label className="block">
          <span className="archive-label text-black/60">TYPE</span>
          <select
            name="submission_type"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
            defaultValue="new_song"
          >
            <option value="new_song">新規楽曲の追加</option>
            <option value="live_setlist">ライブ・セトリ情報</option>
            <option value="link">関連リンク情報</option>
            <option value="correction">既存情報の修正</option>
            <option value="other">その他</option>
          </select>
        </label>

        <label className="block">
          <span className="archive-label text-black/60">PROPOSAL</span>
          <textarea
            name="proposed_value"
            required
            rows={7}
            placeholder="提供したい情報を書いてください。新規楽曲の場合は、曲名・公開日・名義・種類・出典URLなどがあると助かります。"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <label className="block">
          <span className="archive-label text-black/60">SOURCE URL</span>
          <input
            name="source_url"
            type="url"
            placeholder="出典URLがあれば入力"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <label className="block">
          <span className="archive-label text-black/60">COMMENT</span>
          <textarea
            name="comment"
            rows={4}
            placeholder="補足があれば入力"
            className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition placeholder:text-black/35 focus:border-black"
          />
        </label>

        <label className="block">
          <span className="archive-label text-black/60">CONTACT</span>
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