import type { Metadata } from "next";
import StaticInfoPage from "@/components/public/StaticInfoPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact PravixoEduTech for support, content correction requests, student help and platform related queries.",
};

export default function Page() {
  return (
    <StaticInfoPage
      eyebrow="Contact"
      title="Contact PravixoEduTech"
      description="Contact PravixoEduTech for support, content correction requests, student help and platform related queries."
      sections={[
        {
                "title": "Student support",
                "paragraphs": [
                        "Students can contact the PravixoEduTech team for help related to mock test access, login issues, published content, corrections and platform guidance.",
                        "Official email, phone and office details will be added here before production launch."
                ]
        },
        {
                "title": "Content correction requests",
                "paragraphs": [
                        "If any public page contains outdated, incomplete or unclear information, users should report it with the page title, page link and correction details.",
                        "Correction requests will be reviewed and updated according to the correction policy."
                ]
        },
        {
                "title": "Partnership and institute queries",
                "paragraphs": [
                        "PravixoEduTech is designed as an education platform that can support institutes, organizations and learning partners through structured content and mock test systems.",
                        "Partnership contact details and official business communication channels will be added before public production launch."
                ]
        }
]}
      finalNote="Do not publish personal contact details here until the official PravixoEduTech contact email and support process are finalized."
    />
  );
}
