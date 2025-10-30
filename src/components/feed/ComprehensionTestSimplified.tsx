// Simplified version - just a placeholder
import { PostWithAuthor } from '@/lib/types'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface ComprehensionTestProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTestPassed: () => void
  post: PostWithAuthor
}

export const ComprehensionTest: React.FC<ComprehensionTestProps> = ({
  open,
  onOpenChange,
  onTestPassed,
  post,
}) => {
  // Simplified placeholder - just pass
  const handlePass = () => {
    onTestPassed()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Comprehension Test</h2>
          <p className="mb-4">Source: {post.source_url || post.shared_url}</p>
          <button onClick={handlePass} className="px-4 py-2 bg-primary text-white rounded">
            Complete Test
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
