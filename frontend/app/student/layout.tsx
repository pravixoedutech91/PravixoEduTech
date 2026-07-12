import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Student",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
