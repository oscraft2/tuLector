import Link from "next/link";
import { teacherScopeHref, type TeacherOption, type TeacherScope } from "@/lib/teacher_scope";

/**
 * Selector "de quien veo el trabajo": Mis ensayos / Todo el colegio / un docente.
 *
 * Solo se pinta para un admin de plan `school` con equipo (ver canSwitch en
 * teacher_scope.ts). Son enlaces, no un <select> con JS: la pagina ya es de
 * servidor y asi el filtro queda en la URL — se puede compartir, volver atras y
 * recargar sin perderlo.
 */
type Props = {
  scope: TeacherScope;
  teachers: TeacherOption[];
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
};

export function TeacherScopeFilter({ scope, teachers, basePath, searchParams }: Props) {
  // Con un solo docente en el colegio no hay nada que separar.
  if (!scope.canSwitch || teachers.length < 2) return null;

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active ? "bg-[#07305f] text-white" : "bg-[#eef1f5] text-[#5b6472] hover:bg-[#e2e8f0]"
    }`;

  const others = teachers.filter((t) => !t.isSelf);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Ver</span>
      <Link href={teacherScopeHref(basePath, searchParams, "")} className={chip(scope.mode === "mine")}>
        Mis ensayos
      </Link>
      <Link href={teacherScopeHref(basePath, searchParams, "all")} className={chip(scope.mode === "all")}>
        Todo el colegio
      </Link>
      {others.map((t) => (
        <Link
          key={t.userId}
          href={teacherScopeHref(basePath, searchParams, t.userId)}
          className={chip(scope.mode === "one" && scope.userId === t.userId)}
          title={t.label}
        >
          <span className="block max-w-[14rem] truncate">{t.label}</span>
        </Link>
      ))}
    </div>
  );
}
