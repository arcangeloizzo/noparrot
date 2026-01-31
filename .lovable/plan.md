

# Fix: LinkedIn Preview Cache - Salvare Immagine e Autore

## Problema Identificato

Lo stesso post LinkedIn mostra l'immagine e il nome utente a volte sì e a volte no perché:

1. **Prima visualizzazione**: Il sistema estrae immagine e autore da LinkedIn e li restituisce al client
2. **Salvataggio cache (BUG)**: L'immagine e l'autore **non vengono salvati** nella cache
3. **Visualizzazioni successive**: La cache viene letta, ma `meta_image_url` e autore sono `NULL`

**Prove nel database:**
```
source_url: linkedin.com/posts/george-stern_...
meta_image_url: <nil>   ← Sempre NULL per LinkedIn
title: "Want that next promotion?... | George Stern | 135 commenti"
```

Il titolo contiene l'autore, ma l'immagine non viene mai salvata.

---

## Soluzione Tecnica

### File: `supabase/functions/fetch-article-preview/index.ts`

#### Linee 1757-1764: Passare l'immagine a `cacheContentServerSide()`

**Prima:**
```typescript
if (jinaResult?.content && jinaResult.content.length > 50 && supabase) {
  await cacheContentServerSide(
    supabase,
    url,
    socialPlatform,
    jinaResult.content,
    jinaResult.title
    // ❌ MISSING: jinaResult.image
  );
}
```

**Dopo:**
```typescript
if (jinaResult?.content && jinaResult.content.length > 50 && supabase) {
  await cacheContentServerSide(
    supabase,
    url,
    socialPlatform,
    jinaResult.content,
    jinaResult.title,
    jinaResult.image || jinaResult.previewImg // ✅ Passare l'immagine
  );
}
```

---

## Impatto

- **LinkedIn**: L'immagine del post verrà salvata nella cache e mostrata consistentemente
- **TikTok/Threads**: Stesso fix si applica (usano lo stesso blocco di codice)
- **Altre piattaforme**: Non toccate (Spotify, YouTube hanno già il loro flusso separato)

---

## Perché il TTL corto non aiuta?

Il sistema usa un TTL di 15 minuti per entry senza immagine (linea 799-802):

```typescript
if (imageUrl && imageUrl.length > 5) {
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days TTL
} else {
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min TTL
}
```

Ma siccome l'immagine non viene mai salvata per LinkedIn, ogni entry ha TTL di 15 minuti. Dopo la scadenza, il refresh sovrascrive la cache **senza immagine ancora**, creando un loop infinito.

---

## Test Post-Implementazione

1. Condividere un nuovo post LinkedIn con immagine
2. Verificare che la cache abbia `meta_image_url` popolato
3. Refreshare la pagina più volte e verificare che l'immagine sia sempre visibile
4. Verificare che i post esistenti si aggiornino al prossimo refresh (dopo scadenza cache)

