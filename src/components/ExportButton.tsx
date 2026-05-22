"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ExportResult } from "@/lib/airtable-export";

type ExportButtonProps = {
  projectId: string;
  onExportComplete?: (result: ExportResult) => void;
};

/**
 * Button to trigger Airtable export for a project.
 * Shows loading state during export, then displays result.
 */
export function ExportButton({ projectId, onExportComplete }: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiFetch<ExportResult>(
        `/api/projects/${projectId}/export`,
        {
          method: "POST",
        }
      );

      setResult(response);
      onExportComplete?.(response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Export failed";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleExport}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Exporting to Airtable..." : "Export to Airtable"}
      </button>

      {result && (
        <div
          className={`rounded-md p-3 text-sm ${
            result.success
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-yellow-50 border border-yellow-200 text-yellow-800"
          }`}
        >
          <div className="font-medium">{result.message}</div>
          <div className="mt-1 text-xs opacity-75">
            Exported: {result.exported} / {result.totalTasks}
            {result.failed > 0 && ` • Failed: ${result.failed}`}
          </div>

          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium text-xs">
                Show errors ({result.errors.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {result.errors.map((err) => (
                  <li key={err.taskId} className="ml-2">
                    <strong>{err.title}</strong>: {err.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md p-3 text-sm bg-red-50 border border-red-200 text-red-800">
          <div className="font-medium">Export failed</div>
          <div className="mt-1 text-xs">{error}</div>
        </div>
      )}
    </div>
  );
}
