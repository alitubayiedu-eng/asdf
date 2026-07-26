import type { Config } from "tailwindcss";
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        cream: v("cream"),
        surface: v("surface"),
        card: v("card"),
        line: v("line"),
        // نام‌های معنایی جدید
        primary: v("primary"),
        "primary-soft": v("primary-soft"),
        "primary-deep": v("primary-deep"),
        accent: v("accent"),
        "accent-lite": v("accent-lite"),
        sidebar: v("sidebar"),
        "sidebar-accent": v("sidebar-accent"),
        ok: v("ok"),
        warn: v("warn"),
        danger: v("danger"),
        // نام‌های قدیمی — برای سازگاری کد موجود
        blueprint: v("primary"),
        crane: v("accent"),
        graphite: v("sidebar"),
      },
      fontFamily: { sans: ["Vazirmatn", "Tahoma", "sans-serif"] },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem", "3xl": "1.5rem" },
      boxShadow: {
        soft: "0 1px 3px rgb(var(--shadow) / .06), 0 1px 2px rgb(var(--shadow) / .04)",
        lift: "0 10px 24px rgb(var(--shadow) / .10)",
      },
    },
  },
  plugins: [],
};
export default config;
