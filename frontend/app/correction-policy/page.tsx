import type { Metadata } from "next";
import StaticInfoPage from "@/components/public/StaticInfoPage";

export const metadata: Metadata = {
  title: "Correction Policy",
  description: "Read how PravixoEduTech handles corrections, updates and content improvement requests for public exam preparation pages.",
};

export default function Page() {
  return (
    <StaticInfoPage
      eyebrow="Correction Policy"
      title="Correction Policy"
      description="Read how PravixoEduTech handles corrections, updates and content improvement requests for public exam preparation pages."
      sections={[
        {
                "title": "When corrections are needed",
                "paragraphs": [
                        "Corrections may be needed when an exam date changes, an official notice is updated, eligibility information changes, a result link changes or any content becomes outdated.",
                        "Corrections may also be made to improve clarity, grammar, readability and student guidance."
                ]
        },
        {
                "title": "How corrections are reviewed",
                "paragraphs": [
                        "Correction requests should include the page title, page link, issue description and, where possible, the official source or reference for the correction.",
                        "The team should review the issue, update the content if needed and preserve clarity for students."
                ]
        },
        {
                "title": "Update transparency",
                "paragraphs": [
                        "Important content pages should show update dates or review context when relevant.",
                        "Major updates should be handled carefully so students are not confused by old exam information."
                ]
        },
        {
                "title": "Official source priority",
                "paragraphs": [
                        "For exam notifications, admit cards, results, vacancies and syllabus updates, official exam authority sources should be treated as the final reference.",
                        "PravixoEduTech content is for preparation and awareness, not a replacement for official notices."
                ]
        }
]}
      finalNote="This correction policy is part of the platform trust foundation and can be expanded after the admin content workflow is complete."
    />
  );
}
