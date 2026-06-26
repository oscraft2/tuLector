"use client";

import { useMemo, useState } from "react";

export function AnswerKeyEditor({ name = "answer_key", questions = 20, defaultValue = "" }: { name?: string; questions?: number; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue.toUpperCase());
  const clean = value.toUpperCase().replace(/[^A-E]/g, "");
  const valid = clean.length === questions;
  const preview = useMemo(() => Array.from({ length: questions }, (_, i) => clean[i] ?? "-"), [clean, questions]);

  return (
    <div>
      <label className="block text-sm font-semibold text-[#111827]" htmlFor={name}>Clave de respuestas</label>
      <input
        id={name}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value.toUpperCase())}
        className="mt-2 w-full rounded-md border border-[#d8dde3] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#111827]"
        placeholder="ABCDEABCDEABCDEABCDE"
        aria-invalid={!valid}
      />
      <input type="hidden" name={`${name}_clean`} value={clean} />
      <p className={valid ? "mt-2 text-xs text-[#4b5563]" : "mt-2 text-xs font-semibold text-[#b45309]"}>
        {clean.length}/{questions} respuestas validas A-E.
      </p>
      <div className="mt-3 grid grid-cols-10 gap-1" aria-label="Vista de clave">
        {preview.map((answer, index) => (
          <span key={index} className="rounded border border-[#e6e8eb] bg-[#f8f9fb] px-2 py-1 text-center text-xs font-semibold">{index + 1}:{answer}</span>
        ))}
      </div>
    </div>
  );
}
