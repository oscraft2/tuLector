"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { confirmOpenAnswersBulk } from "@/app/dashboard/actions";
import { celdasParaPuntaje, claveCelda, type ItemLote } from "@/lib/open_bulk";

export type CeldaEnPantalla = {
  paperId: string;
  question: number;
  value: number;
  maxPoints: number;
  /** La base ya tiene este mismo valor confirmado. */
  guardada: boolean;
  /** El profesor la cambio y todavia no la guarda. */
  editada: boolean;
  /** Ya tenia un puntaje confirmado al cargar la pagina. */
  revisada: boolean;
  iaSugiere: number | null;
};

type Lote = {
  celdas: ReadonlyMap<string, CeldaEnPantalla>;
  /** Lo guardado en lote desde que se abrio la pagina: celda -> puntaje. */
  guardadas: ReadonlyMap<string, number>;
  registrar: (celda: CeldaEnPantalla) => void;
  quitar: (clave: string) => void;
  marcarGuardadas: (items: ItemLote[]) => void;
  olvidar: (clave: string) => void;
};

const Contexto = createContext<Lote | null>(null);

/** null fuera del proveedor: la celda sigue funcionando sola. */
export const useAbiertasLote = () => useContext(Contexto);

export function AbiertasLoteProvider({ children }: { children: ReactNode }) {
  const [celdas, setCeldas] = useState<ReadonlyMap<string, CeldaEnPantalla>>(new Map());
  const [guardadas, setGuardadas] = useState<ReadonlyMap<string, number>>(new Map());

  const registrar = useCallback((celda: CeldaEnPantalla) => {
    const clave = claveCelda(celda.paperId, celda.question);
    setCeldas((previas) => {
      const antes = previas.get(clave);
      if (antes && (Object.keys(celda) as (keyof CeldaEnPantalla)[]).every((k) => Object.is(antes[k], celda[k]))) return previas;
      return new Map(previas).set(clave, celda);
    });
  }, []);
  const quitar = useCallback((clave: string) => {
    setCeldas((previas) => {
      if (!previas.has(clave)) return previas;
      const nuevas = new Map(previas);
      nuevas.delete(clave);
      return nuevas;
    });
  }, []);
  const marcarGuardadas = useCallback((items: ItemLote[]) => {
    setGuardadas((previas) => {
      const nuevas = new Map(previas);
      for (const i of items) nuevas.set(claveCelda(i.paperId, i.question), i.points);
      return nuevas;
    });
  }, []);
  const olvidar = useCallback((clave: string) => {
    setGuardadas((previas) => {
      if (!previas.has(clave)) return previas;
      const nuevas = new Map(previas);
      nuevas.delete(clave);
      return nuevas;
    });
  }, []);

  const valor = useMemo(() => ({ celdas, guardadas, registrar, quitar, marcarGuardadas, olvidar }), [celdas, guardadas, registrar, quitar, marcarGuardadas, olvidar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

type Pendiente = { lineas: string[]; items: ItemLote[]; soloSinRevisar: boolean; marcarEnPantalla: boolean };

type BarraProps = {
  quizId: string;
  /** Preguntas visibles con puntaje maximo configurado. */
  preguntas: { question: number; maxPoints: number; completacion: boolean }[];
  /** Todas las hojas de la lista filtrada (todas las paginas). */
  paperIds: string[];
  /** Celdas ya confirmadas, como "paperId:pregunta". */
  confirmadas: string[];
  filtro: string;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function AbiertasBarraLote({ quizId, preguntas, paperIds, confirmadas, filtro }: BarraProps) {
  const lote = useAbiertasLote();
  const [enviando, startTransition] = useTransition();
  const [elegida, setElegida] = useState("");
  const [puntos, setPuntos] = useState<number | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  const celdas = [...(lote?.celdas.values() ?? [])];
  const porGuardar = celdas.filter((c) => !c.guardada);
  const editadas = porGuardar.filter((c) => c.editada).length;

  const objetivo = preguntas.filter((p) => !elegida || String(p.question) === elegida);
  const topeComun = objetivo.length ? Math.min(...objetivo.map((p) => p.maxPoints)) : 0;
  const puntosValidos = puntos != null && puntos <= topeComun ? puntos : null;
  const maximos = useMemo(() => new Map(preguntas.map((p) => [p.question, p.maxPoints])), [preguntas]);
  const confirmadasSet = useMemo(() => {
    const todas = new Set(confirmadas);
    for (const clave of lote?.guardadas.keys() ?? []) todas.add(clave);
    return todas;
  }, [confirmadas, lote?.guardadas]);
  const calculo = puntosValidos == null ? null : celdasParaPuntaje({
    paperIds, preguntas: objetivo.map((p) => p.question), puntos: puntosValidos, maximos, confirmadas: confirmadasSet, reemplazar,
  });

  const pedirGuardarTodo = () => {
    setMensaje(null);
    const fuera = porGuardar.filter((c) => !(c.value >= 0 && c.value <= c.maxPoints));
    if (fuera.length) {
      setMensaje({ texto: `Hay ${plural(fuera.length, "celda", "celdas")} fuera de rango. Corrígelas antes de guardar.`, error: true });
      return;
    }
    const cuenta = new Map<number, number>();
    for (const c of porGuardar) cuenta.set(c.value, (cuenta.get(c.value) ?? 0) + 1);
    const sinTocar = porGuardar.filter((c) => !c.editada && !c.revisada).length;
    const contraIa = porGuardar.filter((c) => c.iaSugiere != null && c.iaSugiere !== c.value).length;
    setPendiente({
      lineas: [
        `Guardar ${plural(porGuardar.length, "respuesta", "respuestas")} de esta página: ${[...cuenta].sort((a, b) => a[0] - b[0]).map(([v, n]) => `${n} con ${v}`).join(", ")}.`,
        sinTocar ? `${plural(sinTocar, "no la has tocado", "no las has tocado")}: quedan como revisadas con el puntaje que se ve.` : "",
        contraIa ? `En ${plural(contraIa, "respuesta", "respuestas")} la IA sugería otro puntaje.` : "",
      ].filter(Boolean),
      items: porGuardar.map((c) => ({ paperId: c.paperId, question: c.question, points: c.value })),
      soloSinRevisar: false,
      marcarEnPantalla: true,
    });
  };

  const pedirAplicar = () => {
    if (!calculo || puntosValidos == null) return;
    setMensaje(null);
    const nombres = objetivo.map((p) => `P${p.question}`).join(", ");
    const alumnos = new Set(calculo.items.map((i) => i.paperId)).size;
    const comoCorrecta = objetivo.filter((p) => p.completacion && puntosValidos >= p.maxPoints).map((p) => `P${p.question}`);
    setPendiente({
      lineas: [
        `Poner ${puntosValidos} en ${nombres}: ${plural(calculo.items.length, "respuesta", "respuestas")} de ${plural(alumnos, "estudiante", "estudiantes")} (${filtro}, todas las páginas).`,
        calculo.yaGuardadas ? `${plural(calculo.yaGuardadas, "ya guardada no se toca", "ya guardadas no se tocan")}.` : "",
        calculo.reemplazadas ? `⚠ Se REEMPLAZAN ${plural(calculo.reemplazadas, "puntaje ya guardado", "puntajes ya guardados")}.` : "",
        comoCorrecta.length ? `⚠ En ${comoCorrecta.join(", ")} (completación) esto significa CORRECTA: a DIA se subirá la respuesta de la pauta como si cada estudiante la hubiera escrito.` : "",
      ].filter(Boolean),
      items: calculo.items,
      soloSinRevisar: !reemplazar,
      marcarEnPantalla: true,
    });
  };

  const confirmar = () => {
    if (!pendiente) return;
    const { items, soloSinRevisar } = pendiente;
    setPendiente(null);
    startTransition(async () => {
      try {
        const r = await confirmOpenAnswersBulk({ quizId, items, soloSinRevisar });
        if (!r.ok) { setMensaje({ texto: r.error, error: true }); return; }
        // Si alguien guardo entretanto, esas celdas no se marcan: se refrescan.
        if (r.omitidas === 0) lote?.marcarGuardadas(items);
        setPuntos(null);
        setReemplazar(false);
        setMensaje({
          texto: `✓ ${plural(r.guardadas, "respuesta guardada", "respuestas guardadas")}.` +
            (r.omitidas ? ` ${r.omitidas} ya tenían puntaje y no se tocaron.` : "") +
            (r.sinRecalcular ? ` No se pudo recalcular la nota de ${r.sinRecalcular} hoja(s): usa «Recorregir» en el ensayo.` : ""),
          error: false,
        });
        // Sin router.refresh(): la respuesta de la accion ya trae la pagina
        // actualizada (revalidatePath). Pedir otra recarga encima cortaba esa
        // respuesta y la barra quedaba en "Guardando…" para siempre.
      } catch {
        setMensaje({ texto: "No se pudo guardar. Revisa tu conexión, recarga la página y mira qué quedó guardado.", error: true });
      }
    });
  };

  const boton = "rounded-md border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-white p-4" data-testid="barra-lote">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={pedirGuardarTodo} disabled={enviando || porGuardar.length === 0} className={`${boton} border-[#07305f] bg-[#07305f] text-white`}>
          Guardar todo en esta página ({porGuardar.length})
        </button>
        <span className="text-[11px] text-[#8b93a1]">Una respuesta queda «sin revisar» hasta que se guarda, aunque sea en 0.</span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#eef0f3] pt-3">
        <span className="pb-1.5 text-xs font-semibold text-[#111827]">Poner a toda la lista ({plural(paperIds.length, "estudiante", "estudiantes")}):</span>
        <label className="text-xs font-semibold text-[#5b6472]">
          En
          <select value={elegida} onChange={(e) => { setElegida(e.target.value); setPendiente(null); }} className="mt-1 block rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-xs font-normal">
            {preguntas.length > 1 && <option value="">Todas las visibles</option>}
            {preguntas.map((p) => <option key={p.question} value={String(p.question)}>P{p.question} (máx {p.maxPoints})</option>)}
          </select>
        </label>
        <div className="flex gap-1" role="group" aria-label="Puntaje">
          {[0, 1, 2].map((v) => (
            <button key={v} type="button" onClick={() => { setPuntos(v); setPendiente(null); }} disabled={v > topeComun} aria-pressed={puntosValidos === v}
              title={v > topeComun ? `El máximo común es ${topeComun}: elige una sola pregunta` : undefined}
              className={`${boton} w-10 ${puntosValidos === v ? "border-[#07305f] bg-[#07305f] text-white" : "border-[#cfd6df] bg-white text-[#07305f]"}`}>
              {v}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-[#5b6472]">
          <input type="checkbox" checked={reemplazar} onChange={(e) => { setReemplazar(e.target.checked); setPendiente(null); }} />
          Reemplazar también las ya guardadas
        </label>
        <button type="button" onClick={pedirAplicar} disabled={enviando || !calculo || calculo.items.length === 0 || editadas > 0} className={`${boton} border-[#07305f] text-[#07305f]`}>
          {calculo ? `Aplicar a ${plural(calculo.items.length, "respuesta", "respuestas")}` : "Elige 0, 1 o 2"}
        </button>
      </div>
      {editadas > 0 && <p className="mt-2 text-[11px] font-semibold text-[#b45309]">Tienes {plural(editadas, "cambio sin guardar", "cambios sin guardar")} en esta página: guárdalos antes de aplicar a toda la lista.</p>}

      {pendiente && (
        <div className="mt-3 rounded-md border border-[#fcd34d] bg-[#fffbeb] p-3 text-xs text-[#78350f]" role="alertdialog" aria-label="Confirmar guardado">
          {pendiente.lineas.map((linea) => <p key={linea} className="mb-1 font-semibold">{linea}</p>)}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={confirmar} disabled={enviando} className={`${boton} border-[#07305f] bg-[#07305f] text-white`}>Sí, guardar</button>
            <button type="button" onClick={() => setPendiente(null)} className={`${boton} border-[#cfd6df] bg-white text-[#5b6472]`}>Cancelar</button>
          </div>
        </div>
      )}
      <p aria-live="polite" className={`mt-2 text-xs font-semibold ${mensaje?.error ? "text-[#b91c1c]" : "text-[#0f766e]"}`}>
        {enviando ? "Guardando…" : mensaje?.texto ?? ""}
      </p>
    </div>
  );
}
