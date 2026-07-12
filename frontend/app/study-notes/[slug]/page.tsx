import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicContentDetailPage from "@/components/public/PublicContentDetailPage";
import { getPublicContentBySlug } from "@/lib/publicContent";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { item } = await getPublicContentBySlug(slug);

  if (!item || item.type !== "study_note") {
    return {
      title: "Content Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: item.seoTitle || item.title,
    description:
      item.seoDescription ||
      item.summary ||
      `Read ${item.title} on PravixoEduTech.`,
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return (
    <PublicContentDetailPage
      slug={slug}
      expectedType="study_note"
      backHref="/study-notes"
      backLabel="Study Notes"
    />
  );
}
