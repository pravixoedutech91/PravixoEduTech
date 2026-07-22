import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Study Notes",
  description: "Find topic-wise study notes for revision, concept clarity and exam preparation.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="study_note"
      title="Study Notes"
      eyebrow="Notes"
      description="Find topic-wise study notes for revision, concept clarity and exam preparation."
      routeBase="/study-notes"
      emptyTitle="Study notes will appear here"
      emptyDescription="Published study notes will be listed here once content is added."
    />
  );
}
