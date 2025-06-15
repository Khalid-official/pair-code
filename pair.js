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

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function GIFTED_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
                },
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                logger: pino({ level: "fatal" }),
                syncFullHistory: false,
                browser: Browsers.macOS("Safari")
            });

            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(3000);

                    const credsPath = `./temp/${id}/creds.json`;
                    const buffer = fs.readFileSync(credsPath);

                    // Send creds.json as a document
                    await sock.sendMessage(sock.user.id, {
                        document: buffer,
                        mimetype: 'application/json',
                        fileName: `${sock.user.id.split('@')[0]}-creds.json`
                    });

                    // Optional text message
                    await sock.sendMessage(sock.user.id, {
                        text: `✅ *Session file (creds.json) has been delivered successfully!*

> Keep it safe. Do not share with others.
> You can use it to restore this session.`
                    });

                    await delay(2000);
                    await sock.ws.close();
                    removeFile('./temp/' + id);
                    console.log(`✅ ${sock.user.id} connected and creds sent. Restarting...`);
                    await delay(500);
                    process.exit();
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(1000);
                    GIFTED_MD_PAIR_CODE(); // retry
                }
            });
        } catch (err) {
            console.error("❌ Error during pairing:", err);
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.send({ code: "❗ Service Unavailable" });
            }
        }
    }

    return await GIFTED_MD_PAIR_CODE();
});

module.exports = router;
