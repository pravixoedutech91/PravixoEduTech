import type { Metadata } from "next";
import StaticInfoPage from "@/components/public/StaticInfoPage";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description: "Read the PravixoEduTech editorial policy for public exam preparation content, updates, notes and educational guidance.",
};

export default function Page() {
  return (
    <StaticInfoPage
      eyebrow="Editorial Policy"
      title="Editorial Policy"
      description="Read the PravixoEduTech editorial policy for public exam preparation content, updates, notes and educational guidance."
      sections={[
        {
                "title": "Content purpose",
                "paragraphs": [
                        "PravixoEduTech public content is created to help aspirants understand exam updates, syllabus structure, preparation topics, current affairs and learning strategy.",
                        "Content should be educational, clear, student-friendly and aligned with exam preparation needs."
                ]
        },
        {
                "title": "Accuracy and review",
                "paragraphs": [
                        "Content creators should check important dates, eligibility, official notifications and result-related updates before publishing.",
                        "Pages should include update context where needed, and users should be advised to verify final notices from official exam authority websites."
                ]
        },
        {
                "title": "AI-readable structure",
                "paragraphs": [
                        "Public pages should be structured with clear headings, quick answers, summaries, tags, update dates and trust notes where appropriate.",
                        "This helps both students and search systems understand the page purpose without confusion."
                ]
        },
        {
                "title": "Independence",
                "paragraphs": [
                        "Educational content should not mislead students or make false promises about selection, marks, jobs or official outcomes.",
                        "Paid offerings, mock tests and login-required features should be clearly separated from public informational content."
                ]
        }
]}
      finalNote="This editorial policy is a foundation version and should be reviewed again before public production launch."
    />
  );
}
