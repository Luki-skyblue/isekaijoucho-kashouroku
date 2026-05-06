"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        pending
          ? "border border-black/30 bg-black/10 px-5 py-3 text-xs font-medium tracking-[0.12em] text-black/45"
          : "border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
      }
    >
      {pending ? "SAVING..." : "SAVE"}
    </button>
  );
}

export function ManagedEditForm({
  action,
  children,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
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

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  return (
    <form
      action={action}
      className="mt-8 space-y-10"
      onChange={() => setDirty(true)}
      onSubmit={() => setDirty(false)}
    >
      {dirty ? (
        <div className="sticky top-4 z-10 border border-black/20 bg-[#f5f5f2]/95 p-3 text-sm text-black/65 shadow-sm backdrop-blur">
          未保存の変更があります。移動する前に保存してください。
        </div>
      ) : null}

      {children}
    </form>
  );
}

export function ManagedSaveArea() {
  return (
    <div className="border-t border-black/15 pt-6">
      <SaveButton />
    </div>
  );
}