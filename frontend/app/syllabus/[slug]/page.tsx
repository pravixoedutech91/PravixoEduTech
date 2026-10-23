import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicContentDetailPage from "@/components/public/PublicContentDetailPage";
import { getPublicContentMetadata } from "@/lib/publicContentMetadata";

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
  return getPublicContentMetadata(slug, "syllabus");
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return (
    <PublicContentDetailPage
      slug={slug}
      expectedType="syllabus"
      backHref="/syllabus"
      backLabel="Syllabus"
    />
  );
}
