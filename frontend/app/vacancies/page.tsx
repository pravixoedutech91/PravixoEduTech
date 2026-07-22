import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Government Job Vacancies",
  description: "Find government job vacancy updates arranged for quick reading and action.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="vacancy"
      title="Government Job Vacancies"
      eyebrow="Vacancies"
      description="Find government job vacancy updates arranged for quick reading and action."
      routeBase="/vacancies"
      emptyTitle="Vacancy updates will appear here"
      emptyDescription="Published vacancy updates will be listed here."
    />
  );
}
