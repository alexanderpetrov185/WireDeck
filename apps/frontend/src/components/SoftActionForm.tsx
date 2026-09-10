"use client";
// Sprint 23: мягкая отправка действий модерации без полной перезагрузки документа.
// Прогрессивное улучшение поверх нативной формы:
// - JS активен → preventDefault + fetch(POST) к BFF (возвращает JSON), затем
//   router.refresh() — мягкий RSC-refresh, URL не меняется, без document flash;
// - JS не загрузился → форма сабмитится нативно (method=post + action),
//   BFF делает 303-redirect обратно на страницу (рабочий fallback).
// Ошибка показывается инлайном, без навигации прочь.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SoftActionForm({
  action,
  next,
  className,
  children,
}: {
  action: string;
  next?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const reason = form.get("reason");
      const body: Record<string, string> = {};
      if (typeof reason === "string" && reason.trim()) {
        body.reason = reason.trim();
      }
      const resp = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data: { error?: string; message?: string } | null = await resp
        .json()
        .catch(() => null);
      if (!resp.ok || (data && data.error)) {
        throw new Error(
          data?.message || `Action failed (HTTP ${resp.status})`,
        );
      }
      // Мягкий refresh: серверные компоненты пересобираются на том же URL.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      setBusy(false);
    }
  }

  return (
    <form method="post" action={action} className={className} onSubmit={handleSubmit}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {children}
      <span className="flex flex-col gap-0.5">
        {busy && <span className="text-xs text-gray-400">…</span>}
        {error && (
          <span role="alert" className="text-xs text-red-600">
            {error}
          </span>
        )}
      </span>
    </form>
  );
}