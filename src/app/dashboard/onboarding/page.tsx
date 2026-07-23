import { headers } from "next/headers";
import { OnboardingForm } from "./OnboardingForm";

/**
 * Server component delgado: detecta nativo por User-Agent (mismo criterio
 * que dashboard/layout.tsx) y le pasa el valor inicial a OnboardingForm para
 * que renderice la variante correcta desde el primer paint, sin flash.
 * builds viejos del APK (sin el token en el UA) se corrigen client-side
 * dentro de OnboardingForm via isNativeApp().
 */
export default async function OnboardingPage() {
  const ua = (await headers()).get("user-agent") ?? "";
  const nativeInitial = /TuLectorApp/i.test(ua);
  return <OnboardingForm nativeInitial={nativeInitial} />;
}
