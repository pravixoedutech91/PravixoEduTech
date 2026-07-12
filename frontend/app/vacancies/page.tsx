import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Government Job Vacancies",
  description: "Find government job vacancy updates arranged for quick reading and action.",
};

export default function Page() {
  return (
    <PublicContentListPage
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
