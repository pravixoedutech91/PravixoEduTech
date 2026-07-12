import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admit Cards",
  description: "Follow admit card releases, download date updates and next-step guidance.",
};

export default function Page() {
  return (
    <PublicContentListPage
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
