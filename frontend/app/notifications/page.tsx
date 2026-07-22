import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Exam Notifications",
  description: "Track important exam notifications, application dates and official update summaries.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
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
