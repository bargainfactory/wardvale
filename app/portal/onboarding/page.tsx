import { redirect } from "next/navigation";

// The 3-step wizard has been superseded by the Agent Design Studio. Keep this
// route alive (dashboard nudge + welcome-email `next` target both point here)
// by redirecting to the studio.
export default function OnboardingPage() {
  redirect("/portal/studio");
}
