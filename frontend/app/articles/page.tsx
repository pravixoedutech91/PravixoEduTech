import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Exam Preparation Articles",
  description: "Read helpful exam preparation articles, strategy guides, updates and educational explainers.",
};

export default async function Page({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <PublicContentListPage
      page={params?.page}
      type="article"
      title="Exam Preparation Articles"
      eyebrow="Articles"
      description="Read helpful exam preparation articles, strategy guides, updates and educational explainers."
      routeBase="/articles"
      emptyTitle="Articles will appear here"
      emptyDescription="Published articles from the content admin panel will be listed here."
    />
  );
}
