export function getSupportEmail(): string {
  if (
    typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_SUPPORT_EMAIL &&
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL !== "your_support_email@example.com"
  ) {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  }
  return "support@lifepulse.app";
}
