import { useQuotedPost } from "@/hooks/usePosts";
import { QuotedPostCard } from "@/components/feed/QuotedPostCard";
import { useNavigate } from "react-router-dom";

export const InternalPostPreview = ({ postId }: { postId: string }) => {
  const { data: post, isLoading } = useQuotedPost(postId);
  const navigate = useNavigate();

  if (isLoading || !post) return null;

  return (
    <div className="w-full mt-2" onClick={(e) => { e.stopPropagation(); navigate(`/post/${postId}`); }}>
      <QuotedPostCard quotedPost={post} />
    </div>
  );
};
