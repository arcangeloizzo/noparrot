
# Fix Chirurgico: Pulizia LinkedIn per Comprehension Gate

## Riepilogo

Fix backend-only per migliorare la qualità dei quiz su contenuti LinkedIn. Nessun impatto su frontend, altri provider (Spotify/YouTube/Twitter), Trust Score, PULSE o logica commenti.

---

## Modifiche al File

**File unico:** `supabase/functions/generate-qa/index.ts`

---

## 1. Nuova Funzione Helper (linee 99-107)

Inserire la funzione `cleanLinkedInContent()` prima del blocco SOURCE-FIRST Q/A:

```typescript
// ============================================================================
// LINKEDIN CONTENT CLEANING - Deep noise removal for quiz quality
// ============================================================================
function cleanLinkedInContent(content: string): string {
  if (!content) return '';
  
  const originalLength = content.length;
  
  const patterns = [
    // UI noise patterns (existing)
    /Sign in to view more content/gi,
    /Join now to see who you already know/gi,
    /See who you know/gi,
    /Get the LinkedIn app/gi,
    /Skip to main content/gi,
    /LinkedIn and 3rd parties use/gi,
    /Accept & Join LinkedIn/gi,
    /By clicking Continue/gi,
    /Like Comment Share/gi,
    /Report this post/gi,
    /Copy link to post/gi,
    /Repost with your thoughts/gi,
    /More from this author/gi,
    /Welcome back/gi,
    /Don't miss out/gi,
    /LinkedIn Corporation ©/gi,
    /\[Image[^\]]*\]/gi,
    /!\[.*?\]\(.*?\)/gi,
    
    // NEW: Reaction/comment counts (more comprehensive)
    /\d{1,3}(?:[.,]\d{3})*\s*(?:reactions?|likes?|commenti?|comments?|reposts?|condivisioni)/gi,
    /View \d+\s*(?:more\s*)?comments?/gi,
    /\d+\s*(?:più recenti|more recent)/gi,
    
    // NEW: Follower/connection counts
    /\d{1,3}(?:[.,]\d{3})*(?:\+)?\s*(?:follower|collegamenti|connections|seguaci)/gi,
    
    // NEW: Relative timestamps (1w, 3d, 2h, 1 settimana fa, etc.)
    /(?:^|\s)\d+[smhdwMy]\s*(?:•|$)/gm,
    /\d+\s*(?:settiman[aei]|giorn[oi]|or[ae]|minut[oi]|second[oi]|mes[ei]|ann[oi])\s*fa\b/gi,
    /\d+\s*(?:week|day|hour|minute|second|month|year)s?\s*ago\b/gi,
    
    // NEW: Edited/Translated markers
    /\bEdited\b(?:\s*•)?/gi,
    /\bTranslated\b(?:\s*•)?/gi,
    /\bModificato\b(?:\s*•)?/gi,
    /\bTradotto\b(?:\s*•)?/gi,
    
    // NEW: Stray bullets/separators
    /^\s*•\s*/gm,
    /\s*•\s*$/gm,
    
    // NEW: "See more" / "Altro" buttons
    /(?:See more|Altro|Mostra altro|Read more|Leggi tutto)\.{0,3}(?:\s|$)/gi,
    
    // NEW: Only-hashtag lines (preserva hashtag nel testo, rimuove righe solo-hashtag)
    /^(?:#[\w\u00C0-\u024F]+\s*)+$/gm,
  ];
  
  let cleaned = content;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  
  // Normalize whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
  
  // SAFEGUARD: Se la pulizia riduce troppo il contenuto (< 150 chars),
  // mantieni l'originale per evitare fallimento del Comprehension Gate
  if (cleaned.length < 150 && originalLength > 200) {
    console.log(`[generate-qa] ⚠️ LinkedIn cleaning too aggressive, keeping original`);
    return content;
  }
  
  console.log(`[generate-qa] LinkedIn deep clean: ${originalLength} -> ${cleaned.length} chars`);
  return cleaned;
}
```

---

## 2. Sostituzione Pulizia Post-Jina (linee 409-440)

Sostituire il blocco inline con chiamata alla funzione:

```typescript
// LinkedIn-specific deep cleaning (use centralized function)
if (isLinkedIn && extractedContent) {
  extractedContent = cleanLinkedInContent(extractedContent);
}
```

---

## 3. Aggiunta Pulizia Post-Firecrawl (linee 529-535)

Aggiungere pulizia LinkedIn anche dopo Firecrawl:

```typescript
if (firecrawlResponse.ok) {
  const firecrawlData = await firecrawlResponse.json();
  let markdown = firecrawlData.data?.markdown || '';
  
  // Apply LinkedIn cleaning to Firecrawl content too
  const isLinkedInUrl = cacheUrlForRetry?.toLowerCase().includes('linkedin.com');
  if (isLinkedInUrl && markdown) {
    markdown = cleanLinkedInContent(markdown);
  }
  
  if (markdown.length > (serverSideContent?.length || 0)) {
    serverSideContent = markdown;
    contentSource = isLinkedInUrl ? 'firecrawl_linkedin' : 'firecrawl';
    console.log(`[generate-qa] ✅ Firecrawl success: ${serverSideContent.length} chars`);
```

---

## Garanzie Richieste

| Requisito | Soluzione |
|-----------|-----------|
| **Hashtag preservati nel testo** | Pattern `^(?:#[\w\u00C0-\u024F]+\s*)+$` rimuove SOLO righe composte esclusivamente da hashtag, non quelli inline |
| **Fallback sicuro** | Se `cleaned.length < 150 && originalLength > 200`, la funzione restituisce il contenuto originale |
| **Isolamento LinkedIn** | Pulizia attivata SOLO quando `isLinkedIn === true` o `url.includes('linkedin.com')` |
| **Zero regressioni** | Nessun impatto su Spotify, YouTube, Twitter, News, Il Punto |

---

## Test Post-Implementazione

1. Testare il link LinkedIn fornito: https://www.linkedin.com/posts/willmedia-it_il-31-gennaio-2020-il-regno-unito-usciva-activity-7423288980139302913-olNR
2. Verificare che le domande riguardino Brexit/UK, non numeri di commenti
3. Testare un post Spotify per confermare nessuna regressione
4. Testare un post YouTube per confermare nessuna regressione
