interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface SourceTagProps {
  sourceIndices: number[];
  sources: Source[];
  onClick: () => void;
}

export const SourceTag = ({ sourceIndices, sources, onClick }: SourceTagProps) => {
  const primarySource = sources[sourceIndices[0]]?.name || 'Fonte';
  const additionalCount = sourceIndices.length - 1;
  
  return (
    <button 
      onClick={(e) => { 
        e.stopPropagation(); 
        onClick(); 
      }}
      className="inline-flex items-center px-2 py-0.5 bg-primary/20 hover:bg-primary/30 rounded text-xs text-primary font-medium cursor-pointer transition-colors mx-0.5"
    >
      {primarySource.toLowerCase()}
      {additionalCount > 0 && ` +${additionalCount}`}
    </button>
  );
};
