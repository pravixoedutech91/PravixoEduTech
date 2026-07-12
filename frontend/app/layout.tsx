import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default:
      "PravixoEduTech | Government Exam Preparation, Notes, Current Affairs & Mock Tests",
    template: "%s | PravixoEduTech",
  },
  description:
    "Prepare for MPPSC, SSC, Banking, Railway, Vyapam, UPSC and other government exams with notes, current affairs, notifications, syllabus, vacancies and mock tests.",
  keywords: [
    "PravixoEduTech",
    "government exam preparation",
    "MPPSC preparation",
    "SSC mock tests",
    "Banking exam preparation",
    "Railway exam preparation",
    "current affairs",
    "study notes",
    "exam notifications",
  ],
  applicationName: "PravixoEduTech",
  authors: [{ name: "PravixoEduTech" }],
  creator: "PravixoEduTech",
  publisher: "PravixoEduTech",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  openGraph: {
    title:
      "PravixoEduTech | Government Exam Preparation, Notes & Mock Tests",
    description:
      "A focused learning platform for government exam aspirants with public study content and protected mock test practice.",
    url: "/",
    siteName: "PravixoEduTech",
    type: "website",
    locale: "en_IN",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-950">
        {children}
      </body>
    </html>
  );
}
