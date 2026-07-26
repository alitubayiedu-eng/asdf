/** @type {import('next').NextConfig} */
// خروجی استاتیک: روی هر هاست Apache/LiteSpeed (از جمله DirectAdmin) بدون Node.js اجرا می‌شود.
const nextConfig = {
  output: "export",
  trailingSlash: true,               // تولید index.html برای هر مسیر — سازگار با Apache
  images: { unoptimized: true },
  reactStrictMode: true,
  productionBrowserSourceMaps: false, // کد منبع در مرورگر افشا نشود
  poweredByHeader: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",  // اگر در زیرپوشه نصب می‌کنید مقدار بدهید
};
export default nextConfig;
