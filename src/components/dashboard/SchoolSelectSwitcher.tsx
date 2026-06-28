"use client";

import { switchActiveSchool } from "@/app/dashboard/actions";
import { useTransition } from "react";

type UserSchool = {
  id: string;
  name: string;
  role: string;
};

interface SchoolSelectSwitcherProps {
  userSchools: UserSchool[];
  activeSchoolId: string;
}

export function SchoolSelectSwitcher({ userSchools, activeSchoolId }: SchoolSelectSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schoolId = e.target.value;
    if (!schoolId || schoolId === activeSchoolId) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("school_id", schoolId);
      try {
        await switchActiveSchool(formData);
      } catch (err) {
        console.error("Error al cambiar de colegio:", err);
      }
    });
  };

  return (
    <div className={`relative w-full md:max-w-[345px] ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#4b5563]" aria-hidden="true">
        ⌂
      </span>
      <select
        value={activeSchoolId}
        onChange={handleSelectChange}
        className="w-full rounded-md border border-[#cfd6df] bg-white py-3 pl-10 pr-10 text-sm font-semibold text-[#111827] outline-none cursor-pointer focus:border-[#07305f] focus:ring-1 focus:ring-[#07305f] appearance-none"
        aria-label="Seleccionar institución activa"
      >
        {userSchools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name} ({school.role === "admin" ? "Admin" : school.role === "teacher" ? "Profesor" : "Observador"})
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-[#6b7280]" aria-hidden="true">
        ▼
      </span>
    </div>
  );
}
