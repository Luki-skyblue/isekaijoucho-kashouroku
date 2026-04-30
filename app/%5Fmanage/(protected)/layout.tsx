import { redirect } from "next/navigation";
import { isAdminLoggedIn } from "@/lib/adminAuth";

export default async function ManageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loggedIn = await isAdminLoggedIn();

  if (!loggedIn) {
    redirect("/_manage/login");
  }

  return <>{children}</>;
}