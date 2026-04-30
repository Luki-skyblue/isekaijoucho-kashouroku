import { loginAdmin } from "../../actions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ManageLoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <section className="border-y border-black/15 py-8">
        <p className="section-label text-black/45">MANAGE</p>

        <h1 className="font-serif-jp mt-4 text-3xl font-medium tracking-[0.02em] text-black">
          管理ログイン
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          管理用パスワードを入力してください。
        </p>

        {error && (
          <p className="mt-4 border border-black/15 p-3 text-sm text-black/60">
            パスワードが違います。
          </p>
        )}

        <form action={loginAdmin} className="mt-6 space-y-5">
          <label className="block">
            <span className="section-label text-black/45">PASSWORD</span>
            <input
              name="password"
              type="password"
              required
              autoFocus
              className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
            />
          </label>

          <button
            type="submit"
            className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            LOGIN
          </button>
        </form>
      </section>
    </main>
  );
}