import { redirect } from "next/navigation";
import { isAdminLoggedIn } from "@/lib/adminAuth";
import ManageNavigation from "./ManageNavigation";

export default async function ManageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loggedIn = await isAdminLoggedIn();

  if (!loggedIn) {
    redirect("/_manage/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f2]">
      <header className="border-b border-black/15 bg-[#f5f5f2]">
        <div className="mx-auto flex max-w-7xl items-baseline justify-between gap-4 px-6 py-4">
          <div>
            <p className="section-label text-black/40">UNOFFICIAL DATABASE / MANAGE</p>
            <p className="font-serif-jp mt-1 text-lg text-black">歌唱録 管理画面</p>
          </div>
          <span className="text-xs text-black/35">編集モード</span>
        </div>
      </header>
      <ManageNavigation />
      {children}
    </div>
  );
}