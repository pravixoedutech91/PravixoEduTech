import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Admit Cards",
  description: "Follow admit card releases, download date updates and next-step guidance.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="admit_card"
      title="Admit Cards"
      eyebrow="Admit Cards"
      description="Follow admit card releases, download date updates and next-step guidance."
      routeBase="/admit-cards"
      emptyTitle="Admit card updates will appear here"
      emptyDescription="Published admit card updates will be listed here."
    />
  );
}
