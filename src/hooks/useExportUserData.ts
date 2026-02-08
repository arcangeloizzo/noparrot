import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useExportUserData() {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-user-data");
      
      if (error) {
        // Check for rate limit error
        if (error.message?.includes("429") || data?.error === "Rate limit exceeded") {
          const waitTime = data?.retry_after || 60;
          toast.error(`Attendi ${waitTime} secondi prima di richiedere un nuovo export`);
          return;
        }
        throw error;
      }

      // Check for rate limit in response data
      if (data?.error === "Rate limit exceeded") {
        toast.error(data.message || "Attendi prima di richiedere un nuovo export");
        return;
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noparrot-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dati esportati con successo");
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Errore durante l'esportazione");
    } finally {
      setIsExporting(false);
    }
  };

  return { exportData, isExporting };
}
