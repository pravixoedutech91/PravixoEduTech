import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exam Notifications",
  description: "Track important exam notifications, application dates and official update summaries.",
};

export default function Page() {
  return (
    <PublicContentListPage
      type="notification"
      title="Exam Notifications"
      eyebrow="Notifications"
      description="Track important exam notifications, application dates and official update summaries."
      routeBase="/notifications"
      emptyTitle="Notifications will appear here"
      emptyDescription="Published exam notifications will be listed here."
    />
  );
}
