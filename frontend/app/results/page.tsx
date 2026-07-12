import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exam Results",
  description: "Follow result announcements, merit list updates and next-step guidance.",
};

export default function Page() {
  return (
    <PublicContentListPage
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
