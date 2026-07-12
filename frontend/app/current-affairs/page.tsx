import type { Metadata } from "next";
import PublicContentListPage from "@/components/public/PublicContentListPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Current Affairs",
  description: "Read current affairs updates designed for competitive exam preparation.",
};

export default function Page() {
  return (
    <PublicContentListPage
      type="current_affairs"
      title="Current Affairs"
      eyebrow="Current Affairs"
      description="Read current affairs updates designed for competitive exam preparation."
      routeBase="/current-affairs"
      emptyTitle="Current affairs updates will appear here"
      emptyDescription="Published current affairs posts will be listed here."
    />
  );
}
