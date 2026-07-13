import type { Metadata } from "next";
import StaticInfoPage from "@/components/public/StaticInfoPage";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about PravixoEduTech, a public-first government exam preparation platform for notes, updates and mock test practice.",
};

export default function Page() {
  return (
    <StaticInfoPage
      eyebrow="About"
      title="About PravixoEduTech"
      description="Learn about PravixoEduTech, a public-first government exam preparation platform for notes, updates and mock test practice."
      sections={[
        {
                "title": "Our purpose",
                "paragraphs": [
                        "PravixoEduTech helps aspirants find exam updates, syllabus guidance, current affairs, study notes and mock test access in one organized platform.",
                        "The platform is designed especially for students who need simple navigation, clear language and exam-focused learning support."
                ]
        },
        {
                "title": "What we provide",
                "paragraphs": [
                        "The public website includes exam pages, articles, study notes, current affairs, notifications, vacancies, admit card updates, result updates and syllabus pages.",
                        "Mock tests are kept behind student login so attempts, results, review pages and answer security can be managed safely."
                ]
        },
        {
                "title": "Our content approach",
                "paragraphs": [
                        "Content pages are structured with quick answers, readable explanations, update dates and trust notes so students can understand information faster.",
                        "Public content is informational and should be cross-verified with official exam authority websites before making final decisions."
                ]
        }
]}
      finalNote="This About page is the first E-E-A-T foundation page. More organization details, team information and official contact details can be added before production launch."
    />
  );
}
