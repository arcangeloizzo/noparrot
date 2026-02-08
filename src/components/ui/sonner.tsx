import { Toaster as Sonner } from "sonner"
import { CheckCircle, AlertCircle, Info, Loader2 } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      expand={false}
      richColors={false}
      closeButton={false}
      duration={3000}
      gap={8}
      offset="calc(env(safe-area-inset-top, 0px) + 16px)"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-black/90 border border-white/10 shadow-lg backdrop-blur-md min-w-0 max-w-[90vw]",
          title: "text-sm font-medium text-white whitespace-nowrap",
          description: "text-xs text-zinc-400",
          success: "border-emerald-500/20",
          error: "border-red-500/20",
          warning: "border-amber-500/20",
          info: "border-blue-500/20",
        },
      }}
      icons={{
        success: <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
        warning: <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />,
        info: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
        loading: <Loader2 className="w-4 h-4 text-zinc-400 animate-spin flex-shrink-0" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
