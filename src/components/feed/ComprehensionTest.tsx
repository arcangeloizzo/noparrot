// src/components/feed/ComprehensionTest.tsx
import { PostWithAuthor } from '@/integrations/supabase/types'
import { QuizModal } from '../ui/quiz-modal'
import { ArticleReader } from './ArticleReader'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SourceMCQTest } from '../composer/SourceMCQTest'
import { toast } from 'sonner'
import { LoadingOverlay } from '../ui/loading-overlay'

// 1. MODIFICA: Aggiungiamo 'onTestPassed' qui
interface ComprehensionTestProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTestPassed: () => void // <-- AGGIUNTA QUESTA RIGA
  post: PostWithAuthor
}

export const ComprehensionTest: React.FC<ComprehensionTestProps> = ({
  open,
  onOpenChange,
  onTestPassed, // <-- AGGIUNTA QUESTA RIGA
  post,
}) => {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const queryClient = useQueryClient()

  const {
    data: qaData,
    isLoading: isQaLoading,
    isError: isQaError,
  } = useQuery({
    queryKey: ['qa', post.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_qa')
        .select('*')
        .eq('post_id', post.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'validate-answers',
        {
          body: {
            qaId: qaData?.id,
            answers: answers,
          },
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data.isCorrect) {
        toast.success('Corretto! Hai sbloccato il post.')
        queryClient.invalidateQueries({ queryKey: ['gate_passed', post.id] })
        // 2. MODIFICA: Chiamiamo la nuova funzione!
        onTestPassed() // <-- AGGIUNTA QUESTA RIGA
      } else {
        toast.error('Risposte errate. Riprova tra un po.')
        onOpenChange(false)
      }
    },
    onError: () => {
      toast.error('Errore nella validazione. Riprova.')
      onOpenChange(false)
    },
  })

  const handleValidateAnswers = () => {
    mutation.mutate()
  }

  const isLoading = isQaLoading || mutation.isPending

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <ArticleReader
            url={post.source_url!}
            onContinue={() => setStep(1)}
          />
        )
      case 1:
        return (
          <SourceMCQTest
            qaData={qaData}
            answers={answers}
            setAnswers={setAnswers}
            onSubmit={handleValidateAnswers}
            isError={isQaError}
          />
        )
      default:
        return null
    }
  }

  return (
    <QuizModal
      open={open}
      onOpenChange={onOpenChange}
      title={step === 0 ? 'Leggi la fonte' : 'Test di comprensione'}
      description={
        step === 0
          ? 'Leggi questo articolo per sbloccare la conversazione.'
          : 'Rispondi alle domande per dimostrare che hai letto.'
      }
    >
      <div className="relative">
        {isLoading && <LoadingOverlay />}
        {renderStep()}
      </div>
    </QuizModal>
  )
}