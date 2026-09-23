import { redirect } from "next/navigation";

// Legacy route: Finance was renamed to Wealth (convergence with mobile
// terminology). Permanent clients should link /wealth directly.
export default function FinanceRedirectPage() {
  redirect("/wealth");
}
