import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Different Agency Platform | مدیریت پروژه، تولید و انرژی",
  description: "پلتفرم یکپارچه مدیریت پروژه عمرانی، کارخانه، نیروگاه خورشیدی و سیکل ترکیبی — Different Agency",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* تنظیمات اتصال — قبل از بارگذاری برنامه خوانده می‌شود */}
        <script src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/config.js`} />
        <script dangerouslySetInnerHTML={{ __html:
          `try{document.documentElement.setAttribute("data-theme",localStorage.getItem("dap-theme")||"light")}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
