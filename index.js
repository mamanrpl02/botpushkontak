const {
  default: makeWASocket,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");

const Pino = require("pino");
const { setTimeout } = require("timers");

// Mode pairing code dari argument CLI (--useCODE)
const useCODE = process.argv.includes("--useCODE");
console.log("🛠 Mode Pairing Code:", useCODE);

async function connectToWhatsapp() {
  const auth = await useMultiFileAuthState("auth");

  const socket = makeWASocket({
    printQRInTerminal: !useCODE, // Jika tidak menggunakan pairing code, tampilkan QR
    browser: useCODE
      ? ["Chrome (Linux)", "", ""]
      : ["Sibay", "Firefox", "1.0.0"],
    auth: auth.state,
    logger: Pino({ level: "silent" }),
  });

  // Jika menggunakan pairing code & perangkat belum terdaftar
  if (useCODE && !socket.authState.creds.registered) {
    setTimeout(async function () {
      try {
        const pairingCode = await socket.requestPairingCode("6281223937340");
        console.log("✅ Pairing Code Anda:", pairingCode);
      } catch (error) {
        console.error("❌ Gagal mendapatkan pairing code:", error);
      }
    }, 3000);
  }

  socket.ev.on("creds.update", auth.saveCreds);

  socket.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ Terhubung ke Nomor WA:", socket.user.id.split(":")[0]);
    } else if (connection === "close") {
      if (
        lastDisconnect?.error?.output?.statusCode !== 401 // Pastikan bukan logout paksa
      ) {
        console.log("⚠️ Koneksi terputus, mencoba menyambungkan kembali...");
        setTimeout(connectToWhatsapp, 5000); // Delay agar tidak spam reconnect
      } else {
        console.log("❌ Logout terdeteksi, hapus folder auth dan coba ulang.");
      }
    }
  });

  socket.ev.on("messages.upsert", async ({ messages }) => {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Delay kecil
    const msg = messages[0];

    if (!msg.message) return; // Hindari error jika pesan kosong

    // Cek apakah pesan memiliki teks
    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    if (!text) return;

    // Cek apakah pesan berasal dari grup atau pribadi
    const senderNumber = msg.key.remoteJid;
    const isGroup = senderNumber.endsWith("@g.us");

    console.log(`📩 Pesan diterima dari: ${senderNumber} -> ${text}`);

    if (text.toLowerCase() === "halo") {
      console.log("💬 Menerima pesan 'halo', mengirim balasan...");

      // Tambahkan watermark di bawah pesan utama
      const replyMessage = `Hai, ada yang bisa saya bantu?\n\n\n> 🤖 Bot WA IG : @manzstore07`;

      await socket.sendMessage(senderNumber, {
        text: replyMessage,
      });
    }
  });
}

connectToWhatsapp();
