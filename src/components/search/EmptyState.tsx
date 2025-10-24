import { Search } from "lucide-react";

interface EmptyStateProps {
  query: string;
}

export const EmptyState = ({ query }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        Nessun risultato per "{query}"
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Prova con un termine diverso o modifica i filtri di ricerca
      </p>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Suggerimenti:</p>
        <ul className="space-y-1">
          <li>• Controlla l'ortografia</li>
          <li>• Prova parole chiave diverse</li>
          <li>• Estendi l'intervallo di date</li>
          <li>• Rimuovi alcuni filtri</li>
        </ul>
      </div>
    </div>
  );
};
