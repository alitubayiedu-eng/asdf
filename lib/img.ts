"use client";
// فشرده‌سازی تصویر به dataURL برای ذخیره سبک
export function fileToDataUrl(file: File, maxSize = 1000, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      // فایل غیر تصویری: خواندن مستقیم (حداکثر ۲ مگابایت)
      if (file.size > 2 * 1024 * 1024) return reject(new Error("حجم فایل غیرتصویری باید کمتر از ۲ مگابایت باشد."));
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("خطا در خواندن فایل"));
      r.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("خطا در خواندن تصویر"));
    img.src = url;
  });
}
