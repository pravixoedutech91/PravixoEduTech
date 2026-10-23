import type { Metadata } from "next";
import { getPublicContentBySlug, type PublicContentType } from "./publicContent";
import { buildPublicContentMetadata, getTranslationSlug } from "./publicContentSeo";

export const getPublicContentMetadata = async (
  slug: string,
  expectedType: PublicContentType
): Promise<Metadata> => {
  const { item } = await getPublicContentBySlug(slug);

  if (!item || item.type !== expectedType) {
    return {
      title: { absolute: "Content Not Found | PravixoEduTech" },
      robots: { index: false, follow: false },
    };
  }

  // The public endpoint returns published content only. Never advertise a
  // guessed translation URL when it is missing, a draft, or a different type.
  const { item: translation } = await getPublicContentBySlug(getTranslationSlug(slug));
  return buildPublicContentMetadata(item, translation);
};
