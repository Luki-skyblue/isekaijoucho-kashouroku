"use client";

import { useEffect, useState } from "react";

export default function ManageFormGuard({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    setDirty(true);

    const target = event.target;

    if (target instanceof HTMLElement) {
      target.closest<HTMLElement>("[data-managed-field]")?.classList.add(
        "bg-[#efe5cb]/45"
      );
    }
  }

  return (
    <form
      action={action}
      className={className}
      onChange={handleChange}
      onSubmit={() => setDirty(false)}
    >
      {dirty ? (
        <p className="sticky top-4 z-10 border border-black/20 bg-[#f5f5f2]/95 p-3 text-sm text-black/65 shadow-sm backdrop-blur">
          未保存の変更があります。
        </p>
      ) : null}
      {children}
    </form>
  );
}
