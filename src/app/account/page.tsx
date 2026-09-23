import { redirect } from "next/navigation";

// Account lives inside Settings on web (settings#settings-account).
// This route exists so mobile/web capability maps stay aligned.
export default function AccountRedirectPage() {
  redirect("/settings#settings-account");
}
