import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface SharedPathsProps {
  posts: any[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Società & Politica': '#E76A6A',
  'Economia & Business': '#FFD464',
  'Scienza & Tecnologia': '#2AD2C9',
  'Cultura & Arte': '#A98FF8',
  'Pianeta & Ambiente': '#65D08C',
  'Sport & Lifestyle': '#FFB273',
  'Salute & Benessere': '#F28DB7',
  'Media & Comunicazione': '#9AA3AB',
};

export const SharedPaths = ({ posts }: SharedPathsProps) => {
  if (!posts || posts.length === 0) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Percorsi condivisi</h3>
          <p className="text-sm text-muted-foreground">
            Le conversazioni a cui hai scelto di contribuire con consapevolezza.
          </p>
        </div>
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">Nessun percorso condiviso ancora</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Percorsi condivisi</h3>
        <p className="text-sm text-muted-foreground">
          Le conversazioni a cui hai scelto di contribuire con consapevolezza.
        </p>
      </div>

      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className="p-4 bg-card rounded-xl border border-border hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => window.location.href = `/post/${post.id}`}
          >
            <div className="flex items-start gap-3">
              {/* Avatar mini */}
              {post.author?.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground flex-shrink-0">
                  {post.author?.full_name?.[0] || 'U'}
                </div>
              )}

              <div className="flex-1 min-w-0">
                {/* Nome + categoria chip */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {post.author?.full_name || 'Utente'}
                  </span>
                  {post.category && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${CATEGORY_COLORS[post.category] || '#9AA3AB'}20`,
                        color: CATEGORY_COLORS[post.category] || '#9AA3AB',
                      }}
                    >
                      {post.category}
                    </span>
                  )}
                </div>

                {/* Testo preview */}
                <p className="text-sm text-foreground line-clamp-2 mb-2">
                  {post.content}
                </p>

                {/* Data */}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                    locale: it,
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
