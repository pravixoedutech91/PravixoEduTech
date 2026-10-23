import type { PublicContentType } from "./publicContent";

export type PublicContentLanguage = "en-IN" | "hi-IN";

const english = {
  back: "Back to",
  quickAnswer: "Quick Answer",
  contentType: "Content Type",
  category: "Category",
  lastUpdated: "Last Updated",
  updated: "Updated",
  recentlyUpdated: "Recently updated",
  about: "About this page",
  publishedBy: "Published by",
  editorialTeam: "PravixoEduTech Editorial Team",
  reviewStatus: "Content type",
  informational: "Public informational content",
  mainContent: "Main content",
  emptyTitle: "Content body will appear here",
  emptyBody: "The published page exists, but the main content body is currently empty.",
  trustTitle: "Trust note",
  trustBody: "For application dates, eligibility, results and official notices, verify the relevant exam authority website.",
  studyTitle: "Study material note",
  studyBody: "Prepared for exam study and revision. Use the cited references for further reading. Found a factual error? See our",
  correctionPolicy: "correction policy",
  types: {
    article: "Article", study_note: "Study Note", notification: "Notification",
    current_affairs: "Current Affairs", vacancy: "Vacancy", admit_card: "Admit Card",
    result: "Result", syllabus: "Syllabus", exam_page: "Exam Page",
  } satisfies Record<PublicContentType, string>,
  lists: {
    article: "Articles", study_note: "Study Notes", notification: "Notifications",
    current_affairs: "Current Affairs", vacancy: "Vacancies", admit_card: "Admit Cards",
    result: "Results", syllabus: "Syllabus", exam_page: "Exams",
  } satisfies Record<PublicContentType, string>,
};

const hindi: typeof english = {
  back: "वापस जाएँ:",
  quickAnswer: "एक नज़र में",
  contentType: "सामग्री का प्रकार",
  category: "श्रेणी",
  lastUpdated: "अंतिम अपडेट",
  updated: "अपडेट",
  recentlyUpdated: "हाल में अपडेट किया गया",
  about: "इस पृष्ठ के बारे में",
  publishedBy: "प्रस्तुति",
  editorialTeam: "PravixoEduTech संपादकीय टीम",
  reviewStatus: "सामग्री का प्रकार",
  informational: "सार्वजनिक जानकारी",
  mainContent: "मुख्य सामग्री",
  emptyTitle: "मुख्य सामग्री यहाँ दिखाई देगी",
  emptyBody: "यह पृष्ठ प्रकाशित है, लेकिन इसकी मुख्य सामग्री अभी खाली है।",
  trustTitle: "ज़रूरी जानकारी",
  trustBody: "आवेदन की तारीखों, पात्रता, परिणाम और आधिकारिक सूचनाओं की पुष्टि संबंधित परीक्षा प्राधिकरण की वेबसाइट से करें।",
  studyTitle: "अध्ययन सामग्री के बारे में",
  studyBody: "यह सामग्री परीक्षा की तैयारी और पुनरावृत्ति के लिए है। आगे के अध्ययन के लिए दिए गए संदर्भ पढ़ें। कोई तथ्यात्मक त्रुटि मिले तो हमारी",
  correctionPolicy: "सुधार नीति देखें",
  types: {
    article: "लेख", study_note: "अध्ययन नोट", notification: "सूचना",
    current_affairs: "समसामयिकी", vacancy: "भर्ती", admit_card: "प्रवेश पत्र",
    result: "परिणाम", syllabus: "पाठ्यक्रम", exam_page: "परीक्षा जानकारी",
  },
  lists: {
    article: "लेख", study_note: "अध्ययन नोट्स", notification: "सूचनाएँ",
    current_affairs: "समसामयिकी", vacancy: "भर्तियाँ", admit_card: "प्रवेश पत्र",
    result: "परिणाम", syllabus: "पाठ्यक्रम", exam_page: "परीक्षाएँ",
  },
};

export const getPublicContentCopy = (language: PublicContentLanguage) =>
  language === "hi-IN" ? hindi : english;

export const formatPublicContentDate = (
  value: string | undefined,
  language: PublicContentLanguage
) => {
  const fallback = getPublicContentCopy(language).recentlyUpdated;
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(language, {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(date);
};
