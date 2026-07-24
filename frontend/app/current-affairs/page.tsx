import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Current Affairs",
  description: "Read current affairs updates designed for competitive exam preparation.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="current_affairs"
      title="Current Affairs"
      eyebrow="Current Affairs"
      description="Read current affairs updates designed for competitive exam preparation."
      routeBase="/current-affairs"
      promotionPlacement="current_affairs_hero"
      emptyTitle="Current affairs updates will appear here"
      emptyDescription="Published current affairs posts will be listed here."
    />
  );
}
