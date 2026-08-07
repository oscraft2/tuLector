import { redirect } from "next/navigation";

// La gestion de equipo (invitar, revocar, ver uso) se movio a Configuracion.
// Se deja este redirect para no romper enlaces/accesos directos guardados.
export default function TeamPage() {
  redirect("/dashboard/settings");
}
