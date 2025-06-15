const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function BumbleBeePairCode() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
                },
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                syncFullHistory: false
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) res.send({ code });
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(5000);
                    const userJid = sock.user.id;
                    const credsPath = `./temp/${id}/creds.json`;

                    // Send creds.json to user as document
                    try {
                        await sock.sendMessage(userJid, {
                            document: { url: credsPath },
                            mimetype: 'application/json',
                            fileName: 'BumbleBee_creds.json',
                            caption: `✅ *Here is your BumbleBee session file*\n\n📁 Don't share this with anyone!`
                        });

                        // Send BumbleBee GitHub link
                        await sock.sendMessage(userJid, {
                            text: `*Thanks for using BumbleBee 💛*\n\n🔗 GitHub: https://khalid-official/BUMBLEBEE-BOT`
                        });

                    } catch (e) {
                        console.error("Failed to send creds file:", e);
                        await sock.sendMessage(userJid, { text: `❌ Error sending creds file.` });
                    }

                    await delay(3000);
                    await sock.ws.close();
                    removeFile(`./temp/${id}`);
                    process.exit();
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(1000);
                    BumbleBeePairCode();
                }
            });

        } catch (err) {
            console.log("Service Restarted:", err);
            removeFile(`./temp/${id}`);
            if (!res.headersSent) res.send({ code: "❗ Service Unavailable" });
        }
    }

    return await BumbleBeePairCode();
});

module.exports = router;
