import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Exam Syllabus",
  description: "Find exam syllabus pages and subject-wise preparation structure.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="syllabus"
      title="Exam Syllabus"
      eyebrow="Syllabus"
      description="Find exam syllabus pages and subject-wise preparation structure."
      routeBase="/syllabus"
      emptyTitle="Syllabus pages will appear here"
      emptyDescription="Published syllabus content will be listed here."
    />
  );
}
