/**
 * Hash de credenciales locales (modo sin Firebase Auth).
 * Nunca guardar contraseñas en texto claro en localStorage.
 */
(function (global) {
    async function hashClubAccessKey(value) {
        const raw = String(value || '');
        if (!raw) return '';
        if (global.crypto && global.crypto.subtle) {
            const encoded = new TextEncoder().encode(raw);
            const digest = await global.crypto.subtle.digest('SHA-256', encoded);
            return Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
        }
        return btoa(unescape(encodeURIComponent(raw)));
    }

    async function verifyClubAccessKey(plain, storedHash) {
        const h = String(storedHash || '').trim();
        if (!h || !plain) return false;
        const computed = await hashClubAccessKey(plain);
        return computed === h;
    }

    function stripPasswordFields(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        const next = { ...obj };
        delete next.password;
        delete next.pass;
        delete next.plainPassword;
        return next;
    }

    async function migrateRecordCredentials(record) {
        if (!record || typeof record !== 'object') return { record, changed: false };
        let changed = false;
        const next = { ...record };
        if (next.password) {
            if (!next.passwordHash) {
                next.passwordHash = await hashClubAccessKey(next.password);
            }
            delete next.password;
            changed = true;
        }
        if (next.pass) {
            delete next.pass;
            changed = true;
        }
        if (next.plainPassword) {
            delete next.plainPassword;
            changed = true;
        }
        return { record: next, changed };
    }

    async function sanitizeLocalStorageList(localKey) {
        if (typeof localStorage === 'undefined' || !localKey) return 0;
        let list;
        try {
            list = JSON.parse(localStorage.getItem(localKey) || '[]');
        } catch (_) {
            return 0;
        }
        if (!Array.isArray(list)) return 0;
        let changes = 0;
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const { record, changed } = await migrateRecordCredentials(list[i]);
            out.push(record);
            if (changed) changes += 1;
        }
        if (changes > 0) {
            localStorage.setItem(localKey, JSON.stringify(out));
        }
        return changes;
    }

    async function sanitizeClubLocalCredentials() {
        const keys = [
            'clubMembers',
            'members',
            'socios',
            'clubFriends',
            'friends',
            'amigos',
            'cdsanabriacfTeamAdmins',
            'clubCoaches'
        ];
        let total = 0;
        for (const key of keys) {
            total += await sanitizeLocalStorageList(key);
        }
        if (total > 0) {
            console.log(`🔒 Credenciales locales: ${total} registro(s) sin contraseña en claro (solo hash o Firebase Auth).`);
        }
        return total;
    }

    global.hashClubAccessKey = hashClubAccessKey;
    global.verifyClubAccessKey = verifyClubAccessKey;
    global.stripPasswordFields = stripPasswordFields;
    global.migrateRecordCredentials = migrateRecordCredentials;
    global.sanitizeClubLocalCredentials = sanitizeClubLocalCredentials;
})(typeof window !== 'undefined' ? window : globalThis);
