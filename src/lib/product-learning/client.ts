"use client";

import { classifyViewport, type ProductLearningEvent, type ProductLearningFailureReason } from "./events";

export async function recordProductLearningEvent(event: ProductLearningEvent, options: { reason?: ProductLearningFailureReason } = {}) {
  try {
    const width = typeof window === "undefined" ? null : window.innerWidth;
    await fetch("/api/product-learning/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata: { ...options, viewport: classifyViewport(width) } }),
      keepalive: true,
    });
  } catch {
    // Product learning must never interrupt the product path.
  }
}
