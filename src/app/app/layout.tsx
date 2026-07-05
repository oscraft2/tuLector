import { NativeBottomNav } from "@/components/native/NativeBottomNav";

/**
 * Layout de las pantallas nativas (/app/*). Mantiene la barra inferior MONTADA
 * entre navegaciones (Next preserva el layout) → no parpadea ni se re-renderiza
 * al cambiar de pantalla, dando la sensacion "de app". El contenido de cada
 * ruta se intercambia dentro; con los loading.tsx de cada carpeta, la
 * transicion muestra un esqueleto al instante en vez de congelarse.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <NativeBottomNav />
    </>
  );
}
