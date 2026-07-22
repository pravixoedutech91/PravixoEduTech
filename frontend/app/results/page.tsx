import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Exam Results",
  description: "Follow result announcements, merit list updates and next-step guidance.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="result"
      title="Exam Results"
      eyebrow="Results"
      description="Follow result announcements, merit list updates and next-step guidance."
      routeBase="/results"
      emptyTitle="Result updates will appear here"
      emptyDescription="Published result updates will be listed here."
    />
  );
}
