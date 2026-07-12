import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exam Syllabus",
  description: "Find exam syllabus pages and subject-wise preparation structure.",
};

export default function Page() {
  return (
    <PublicContentListPage
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
