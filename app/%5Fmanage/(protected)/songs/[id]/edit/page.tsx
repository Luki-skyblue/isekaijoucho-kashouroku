import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ManageSongEditRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/_manage/songs/${id}`);
}
