"use client";

import { useState } from "react";
import { createEvaluationFileUrl } from "@/app/dashboard/evaluation-actions";

export function EvaluationFileButton({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        className="text-sm font-semibold text-blue-900 hover:text-blue-700"
        onClick={async () => {
          const result = await createEvaluationFileUrl(fileId);
          if (result.url) {
            window.open(result.url, "_blank", "noopener,noreferrer");
            setMessage(null);
            return;
          }
          setMessage(result.error);
        }}
        type="button"
      >
        Open {fileName}
      </button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
