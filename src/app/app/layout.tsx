import { ViewTransition } from "react";
import { NativeBottomNav } from "@/components/native/NativeBottomNav";

/**
 * Layout de las pantallas nativas (/app/*). Mantiene la barra inferior MONTADA
 * entre navegaciones (Next preserva el layout) → no parpadea ni se re-renderiza
 * al cambiar de pantalla, dando la sensacion "de app". El contenido de cada
 * ruta se intercambia dentro; con los loading.tsx de cada carpeta, la
 * transicion muestra un esqueleto al instante en vez de congelarse.
 *
 * ViewTransition (experimental.viewTransition en next.config.ts) anima el
 * cambio: "fade" por defecto (cambiar de tab), "nav-forward"/"nav-back" para
 * entrar/salir de un detalle (ver transitionTypes en los Link de
 * ResultsScreen/StudentsScreen y los links "Volver" de las pantallas de
 * detalle). NativeBottomNav queda FUERA del ViewTransition a proposito — no
 * debe deslizarse ni desvanecerse con el contenido.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewTransition
        enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
        exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      >
        {children}
      </ViewTransition>
      <NativeBottomNav />
    </>
  );
}
