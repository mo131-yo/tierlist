"use client";

import { useEffect } from "react";

/** Production-д /sw.js-ийг бүртгэнэ. Dev-д HMR-тэй зөрчилддөг тул алгасна. */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
