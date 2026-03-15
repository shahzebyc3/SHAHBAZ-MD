'use strict';

const axios  = require('axios');
const moment = require('moment-timezone');

const REPO_URL    = 'https://github.com/shahzebyc3/SHAHBAZ-MD';
const WEBSITE_URL = '';
const WA_CHANNEL  = 'https://whatsapp.com/channel/0029Vb75RsG9Gv7Lr28vn92O';
const SUPPORT_URL = 'https://chat.whatsapp.com/E1KiIVTLQ1oKAw0O62YUQW?mode=gi_t';

module.exports = {
    commands:    ['repo', 'repository', 'github'],
    description: 'Show SHAHBAZ MD repository info',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { contextInfo } = ctx;
        const jid = message.key.remoteJid;

        let data = null;
        try {
            const res = await axios.get(
                'https://api.github.com/repos/shahzebyc3/SHAHBAZ-MD',
                { timeout: 10000 }
            );
            data = res.data;
        } catch { /* use fallback */ }

        const caption = data
            ? `*✨ SHAHBAZ MD — REPOSITORY INFO*\n\n` +
              `📦 *Repo:* ${data.name}\n` +
              `📝 *About:* ${data.description || 'WhatsApp MD Bot'}\n\n` +
              `⭐ *Stars:* ${data.stargazers_count.toLocaleString()}\n` +
              `🍴 *Forks:* ${data.forks_count.toLocaleString()}\n` +
              `💻 *Language:* ${data.language || 'JavaScript'}\n` +
              `📦 *Size:* ${(data.size / 1024).toFixed(1)} MB\n` +
              `📜 *License:* ${data.license?.name || 'MIT'}\n` +
              `⚠️ *Open Issues:* ${data.open_issues}\n` +
              `🕒 *Updated:* ${moment(data.updated_at).fromNow()}\n\n` +
              `🔗 *GitHub:* ${REPO_URL}\n` +
              `🌐 *Website:* ${WEBSITE_URL}\n` +
              `📢 *Newsletter:* ${WA_CHANNEL}\n` +
              `💬 *Support:* ${SUPPORT_URL}\n\n` +
              `⚡ _Powered by Silva Tech Inc_`
            : `*✨ SHAHBAZ MD — REPOSITORY*\n\n` +
              `📦 *Repo:* SHAHBAZ-MD\n` +
              `💻 *Language:* JavaScript\n` +
              `📜 *License:* MIT\n\n` +
              `🔗 *GitHub:* ${REPO_URL}\n` +
              `🌐 *Website:* ${WEBSITE_URL}\n` +
              `📢 *Newsletter:* ${WA_CHANNEL}\n` +
              `💬 *Support:* ${SUPPORT_URL}\n\n` +
              `⚡ _Powered by Shahbaz Tech Inc_`;

        const imgUrl = 'https://files.catbox.moe/l7d81a.png';

        await sock.sendMessage(jid, {
            image:   { url: imgUrl },
            caption,
            contextInfo: {
                ...contextInfo,
                externalAdReply: {
                    title:                 'SHAHBAZ MD — Open Source Bot',
                    body:                  'Star us on GitHub!',
                    thumbnailUrl:          imgUrl,
                    sourceUrl:             REPO_URL,
                    mediaType:             1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });
    }
};
