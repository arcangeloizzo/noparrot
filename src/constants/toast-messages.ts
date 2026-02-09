export const TOASTS = {
    // Auth
    AUTH_REQUIRED: {
        description: "Effettua il login per continuare",
        action: { label: "Accedi", onClick: () => window.location.href = "/auth" }
    },
    FOLLOW_SUCCESS: {
        description: (username: string) => `Hai iniziato a seguire ${username}`
    },
    UNFOLLOW_SUCCESS: {
        description: (username: string) => `Non segui più ${username}`
    },

    // Upload
    UPLOAD_LIMIT_REACHED: {
        description: (max: number) => `Massimo ${max} file consentiti`
    },
    VIDEO_TOO_LONG: {
        description: "La durata massima è 3 minuti"
    },
    UPLOAD_SUCCESS: {
        description: "I tuoi file sono pronti"
    },
    TRANSCRIPTION_STARTED: {
        description: "Trascrizione avviata..."
    },
    TRANSCRIPTION_SUCCESS: {
        description: "Trascrizione completata!"
    },
    TRANSCRIPTION_FAILED: {
        description: "Trascrizione fallita. Puoi pubblicare comunque."
    },

    // Share
    SHARE_READY: {
        description: "Scegli dove pubblicare"
    },
    READ_REQUIRED: {
        description: "Approfondisci prima di diffondere"
    },
    LINK_EXTERNAL: {
        description: "Apro nel browser per compatibilità"
    },

    // Gate
    GATE_PASSED: {
        description: "Hai messo a fuoco il contenuto"
    },
    GATE_FAILED: {
        description: "Serve più attenzione ai dettagli"
    },
    GATE_INSUFFICIENT_CONTENT: {
        description: "Puoi comunque condividere questo post"
    },

    // Generic
    ERROR_GENERIC: {
        description: "Qualcosa non va. Riprova tra un attimo."
    },
    NOTIFICATIONS_ACTIVE: {
        description: "Non perderai nessun aggiornamento"
    },
    DEBUG_MODE: {
        description: (enabled: boolean) => `Modalità Debug ${enabled ? 'ATTIVA' : 'DISATTIVA'}`
    }
} as const;
