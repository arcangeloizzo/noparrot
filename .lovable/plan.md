

# Redesign Voice Post Card & Challenge Card

## Contesto
Attualmente le card vocali e challenge nel feed sono piatte e generiche (immagini 1-2). Il concept di riferimento (immagini 3-5) mostra un design molto più ricco con badge colorati, player emotivo, barra di polarizzazione e lista challenger ordinata. Il redesign tocca 3 componenti principali.

## Componenti da modificare

### 1. VoicePlayer (`src/components/media/VoicePlayer.tsx`) — Redesign Player Audio
- **Play button**: Più grande (h-12 w-12), Primary Blue `#0A7AFF`, effetto shadow/glow
- **Waveform**: Barre più spesse e definite, colore `#0A7AFF` per parte riprodotta, `white/15` per il resto
- **Layout**: Tempo nel formato `0:00 / 2:43` sotto la waveform a sinistra
- **Controlli**: Speed toggle (`1x`) e bottone `📝 Testo` come pill compatte in basso a destra
- **Container**: Glassmorphism più pronunciato (`bg-white/5 backdrop-blur-xl border border-white/10`)
- Aggiungere prop `compact` per la versione ridotta usata nelle risposte challenger

### 2. Voice Post Card — Sezione in `ImmersivePostCard.tsx` (linee ~1512-1531) e `FeedCardAdapt.tsx` (linee ~895-920)
- **Badge header**: Aggiungere badge `🎙 VOICE` accanto al nome autore, testo `#FFD464` (Brand Yellow) su sfondo scuro (`bg-yellow-500/10 rounded-full px-2 py-0.5`)
- **Testo del post**: Se presente `post.content`, renderizzarlo come titolo bold 16-18px sopra il player — è il "titolo" dell'audio
- **Player**: Usare il VoicePlayer ridisegnato, rimuovere il label "Pensiero Vocale" che ora è nel badge
- **Action bar**: "Condividi" diventa icona piccola, "Metti a fuoco" diventa CTA primaria

### 3. ChallengeCard (`src/components/feed/ChallengeCard.tsx`) — Redesign Completo
- **Header**: Badge `⚡ CHALLENGE` con testo `#E41E52` (Brand Pink), sfondo `bg-rose-500/10`, font bold uppercase
- **Tesi**: Font bold ~18px, più spaziatura verticale (padding generoso), testo della tesi come hero
- **Player autore**: VoicePlayer standard con glassmorphism, sotto la tesi
- **Barra polarizzazione**: Mantieni layout attuale (rosso/verde) ma con label "contro" a sinistra e "a favore" a destra come nel concept (percentuali colorate)
- **Lista Challenger**: Sezione collassabile "N challenger · per qualità argomento"
  - Ogni risposta: numero ranking, avatar, nome, badge stance (Contro rosso / A favore verde), badge "✓ Gate"
  - Player audio compatto (prop `compact` del VoicePlayer)
  - Bottone "🧠 Miglior argomento" con contatore voti
  - Ordinamento per `argument_votes` desc
- **CTA finale**: Bottone full-width `⚡ Accetta la sfida · metti a fuoco prima` con sfondo `bg-rose-500/20 border border-rose-500/30`, ben visibile

### 4. Integrazione nel feed immersivo (`ImmersivePostCard.tsx`)
- Per challenge post nel feed immersivo: mostrare versione condensata (tesi + player + barra voti) con CTA per aprire la card completa in un sheet/overlay
- Per voice post: applicare badge e nuovo layout player

## Palette colori (brand-aligned)
- Voice badge: `#FFD464` (Brand Yellow)
- Challenge badge/accents: `#E41E52` (Brand Pink)
- Play button: `#0A7AFF` (Primary Blue)
- A favore: `#34D399` (emerald)
- Contro: `#E41E52` (rose/brand pink)
- Glassmorphism: `bg-white/5 backdrop-blur-xl border-white/10`

## File coinvolti
1. `src/components/media/VoicePlayer.tsx` — redesign player + aggiunta prop `compact`
2. `src/components/feed/ChallengeCard.tsx` — redesign completo
3. `src/components/feed/FeedCardAdapt.tsx` — voice post badge + layout nella card classica
4. `src/components/feed/ImmersivePostCard.tsx` — voice/challenge nel feed immersivo

