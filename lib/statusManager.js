'use strict';

/**
 * lib/statusManager.js
 * Centralised handler for status@broadcast messages.
 * Covers: auto-view, auto-like (react), auto-reply, status-saver.
 */

const config = require('../config');

// ─── Settings resolver ────────────────────────────────────────────────────────
function getAutoStatusSettings() {
    const flags = global.autoStatusFlags || {};

    // FIX: Added explicit true/false fallback to avoid undefined/null silently
    //      disabling features when config values are missing.
    const resolve = (flagVal, configVal) => {
        if (flagVal !== null && flagVal !== undefined) return String(flagVal);
        if (configVal !== null && configVal !== undefined) return String(configVal);
        return 'false'; // safe default — never silently undefined
    };

    return {
        autoviewStatus:  resolve(flags.seen,  config.AUTO_STATUS_SEEN),
        autoLikeStatus:  resolve(flags.react, config.AUTO_STATUS_REACT),
        autoReplyStatus: resolve(null,         config.AUTO_STATUS_REPLY),
        statusReplyText: config.AUTO_STATUS_MSG    || 'Seen by SHAHBAZ-MD 💖',
        statusLikeEmojis:config.CUSTOM_REACT_EMOJIS|| '❤️,🔥,💯,😍,👏',
        statusSaver:     resolve(null,         config.Status_Saver  || 'false'),
        statusSaverReply:resolve(null,         config.STATUS_REPLY  || 'false'),
        statusSaverMsg:  config.STATUS_MSG || 'SHAHBAZ MD 💖 SUCCESSFULLY VIEWED YOUR STATUS',
    };
}

// ─── Message-type unwrapper ───────────────────────────────────────────────────
/**
 * Peels off wrapper layers and returns { inner, msgType }.
 * FIX: Now works on a clean copy so it never double-peels.
 */
function unwrapStatus(m) {
    // Work on a shallow copy of the message field to avoid mutating m
    let msg = { ...(m.message || {}) };

    // Peel ephemeral wrapper
    if (msg.ephemeralMessage) msg = { ...(msg.ephemeralMessage.message || msg) };

    // Peel viewOnce wrapper
    const voKey = Object.keys(msg).find(k => k.startsWith('viewOnce'));
    if (voKey) msg = { ...(msg[voKey].message || msg) };

    const ORDER = [
        'imageMessage', 'videoMessage', 'audioMessage',
        'extendedTextMessage', 'conversation', 'stickerMessage',
        'documentMessage', 'reactionMessage',
    ];
    const msgType = ORDER.find(k => msg[k]) || Object.keys(msg)[0] || 'unknown';
    return { inner: msg, msgType };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
/**
 * @param {object}   sock       - Baileys socket instance
 * @param {object}   m          - raw message object from messages.upsert
 * @param {Function} [saveMedia]- optional media-save helper (silva.js saveMedia)
 */
async function handleStatusBroadcast(sock, m, saveMedia) {
    try {
        const settings = getAutoStatusSettings();
        const statusId = m.key.id;
        const userJid  = m.key.participant;

        // Skip own status echoes (participant is null/undefined for our own posts)
        if (!userJid) return;

        // FIX: Removed the inline mutation of m.message before unwrapStatus.
        //      unwrapStatus now handles all wrapper-peeling internally on a copy,
        //      so we don't risk corrupting m before the react/reply steps.
        const { inner, msgType } = unwrapStatus(m);

        console.log(`[StatusManager] 📨 Status from ${userJid} | type: ${msgType} | id: ${statusId}`);
        console.log(`[StatusManager] 🔧 Settings — view:${settings.autoviewStatus} like:${settings.autoLikeStatus} reply:${settings.autoReplyStatus}`);

        // ── 1. Auto View ─────────────────────────────────────────────────────
        if (settings.autoviewStatus === 'true') {
            try {
                // FIX: Pass the original m.key directly. Some Baileys builds also
                //      require the participant field to be set on the key, which
                //      m.key already carries for status@broadcast messages.
                await sock.readMessages([{
                    remoteJid:   'status@broadcast',
                    id:          statusId,
                    participant: userJid,
                    fromMe:      false,
                }]);
                console.log(`[StatusManager] ✅ Status viewed: ${statusId}`);
            } catch (e) {
                console.warn(`[StatusManager] ⚠️ View failed: ${e.message}`);
            }
        }

        // ── 2. Auto Like / React ─────────────────────────────────────────────
        if (settings.autoLikeStatus === 'true') {
            try {
                const emojis      = settings.statusLikeEmojis.split(',').map(e => e.trim()).filter(Boolean);
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)] || '❤️';

                // FIX: Use m.key directly instead of reconstructing it manually.
                //      A hand-built key often mismatches the server's stored key,
                //      causing the reaction to silently fail or be rejected.
                await sock.sendMessage(
                    'status@broadcast',
                    {
                        react: {
                            key:  m.key,   // ← was: { remoteJid, fromMe, id, participant }
                            text: randomEmoji,
                        },
                    }
                );
                console.log(`[StatusManager] ✅ Liked status ${statusId} with ${randomEmoji}`);
            } catch (e) {
                console.warn(`[StatusManager] ⚠️ Like failed: ${e.message}`);
            }
        }

        // ── 3. Auto Reply ────────────────────────────────────────────────────
        if (settings.autoReplyStatus === 'true' && !m.key.fromMe) {
            try {
                await sock.sendMessage(
                    userJid,
                    { text: settings.statusReplyText },
                    { quoted: m }
                );
                console.log(`[StatusManager] ✅ Replied to status: ${statusId}`);
            } catch (e) {
                console.warn(`[StatusManager] ⚠️ Reply failed: ${e.message}`);
            }
        }

        // ── 4. Status Saver ──────────────────────────────────────────────────
        if (settings.statusSaver === 'true' && typeof saveMedia === 'function') {
            try {
                const userName = await sock.getName?.(userJid) || userJid.split('@')[0];
                const header   = 'AUTO STATUS SAVER';
                let   caption  = `${header}\n\n*🩵 Status From:* ${userName}`;

                switch (msgType) {
                    case 'imageMessage':
                    case 'videoMessage':
                        if (inner[msgType]?.caption) caption += `\n*🩵 Caption:* ${inner[msgType].caption}`;
                        await saveMedia({ message: inner }, msgType, sock, caption);
                        break;
                    case 'audioMessage':
                        caption += '\n*🩵 Audio Status*';
                        await saveMedia({ message: inner }, msgType, sock, caption);
                        break;
                    case 'extendedTextMessage':
                        caption = `${header}\n\n${inner.extendedTextMessage?.text || ''}`;
                        await sock.sendMessage(sock.user.id, { text: caption });
                        break;
                    default:
                        console.warn(`[StatusManager] ⚠️ Unsupported status type for saver: ${msgType}`);
                        break;
                }

                if (settings.statusSaverReply === 'true') {
                    await sock.sendMessage(userJid, { text: settings.statusSaverMsg });
                }
                console.log(`[StatusManager] ✅ Status saved: ${statusId}`);
            } catch (e) {
                console.error(`[StatusManager] ❌ Save failed: ${e.message}`);
            }
        }
    } catch (e) {
        console.error(`[StatusManager] ❌ Handler error: ${e.message}`);
    }
}

module.exports = { handleStatusBroadcast, getAutoStatusSettings, unwrapStatus };
