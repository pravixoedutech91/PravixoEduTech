import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Exam Preparation Hub",
  description: "Explore exam-wise preparation guidance, syllabus direction, important updates and learning resources for government exams.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="exam_page"
      title="Exam Preparation Hub"
      eyebrow="Exams"
      description="Explore exam-wise preparation guidance, syllabus direction, important updates and learning resources for government exams."
      routeBase="/exams"
      promotionPlacement="exams_hero"
      emptyTitle="Exam hub pages will appear here"
      emptyDescription="Admin-created exam pages will be shown here after publishing."
    />
  );
}
