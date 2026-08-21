import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ManageReleaseEditRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/_manage/releases/${id}`);
}
