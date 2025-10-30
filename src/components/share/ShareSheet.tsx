// src/components/share/ShareSheet.tsx
import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
// 1. MODIFICA: Importiamo le icone
import { Users, Quote } from 'lucide-react'

// 2. MODIFICA: Definiamo le funzioni che il componente deve ricevere
interface ShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShareToFeed: () => void
  onShareWithFriend: () => void
}

export const ShareSheet: React.FC<ShareSheetProps> = ({
  open,
  onOpenChange,
  onShareToFeed, // <-- Nuova prop
  onShareWithFriend, // <-- Nuova prop
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Condividi post</SheetTitle>
        </SheetHeader>
        {/* 3. MODIFICA: Aggiungiamo i bottoni */}
        <div className="flex flex-col space-y-4 p-4">
          <Button
            variant="outline"
            onClick={onShareToFeed} // <-- Collega la funzione
            className="justify-start"
          >
            <Quote className="mr-2 h-4 w-4" />
            Quota sul tuo feed
          </Button>

          <Button
            variant="outline"
            onClick={onShareWithFriend} // <-- Collega la funzione
            className="justify-start"
          >
            <Users className="mr-2 h-4 w-4" />
            Invia a un amico
          </Button>
          
          {/* Puoi aggiungere altre opzioni qui, come "Copia Link" */}
          
        </div>
      </SheetContent>
    </Sheet>
  )
}