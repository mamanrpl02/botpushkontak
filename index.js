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
        console.log("⏳ Meminta pairing code untuk nomor:", "6281223937340");
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

    // Buat daftar respons berdasarkan teks yang diterima
    let replyMessage = null;

    switch (text.toLowerCase()) {
      case "halo":
      case "hi":
      case "hey":
        replyMessage = `Hai! 😊 Ada yang bisa saya bantu?\n\n> 🤖 Bot WA IG : @manzstore07`;
        break;

      case ".menu":
        replyMessage = `📌 *Menu Layanan*\n1️⃣ Cek harga produk\n2️⃣ Info layanan bot\n3️⃣ Bantuan lainnya\n\nKetik angka pilihan Anda.\n\n> 🤖 Bot WA IG : @manzstore07`;
        break;

      case "1":
        replyMessage = `📍 Harga produk:\n💳 Paket A - Rp50.000\n💳 Paket B - Rp100.000\n\nKetik "beli [paket]" untuk membeli.\n\n> 🤖 Bot WA IG : @manzstore07`;
        break;

      case "2":
        replyMessage = `📢 Bot ini bisa membantu Anda:\n✅ Auto-reply chat\n✅ Auto-broadcast\n✅ Integrasi API WhatsApp\n\nKetik "bantuan" untuk info lebih lanjut.\n\n> 🤖 Bot WA IG : @manzstore07`;
        break;

      case "3":
        replyMessage = `Silakan tanyakan apa yang ingin Anda ketahui. Saya siap membantu! 😊\n\n> 🤖 Bot WA IG : @manzstore07`;
        break;
    }

    // Kirim balasan hanya jika ada pesan yang sesuai
    if (replyMessage) {
      await socket.sendMessage(senderNumber, { text: replyMessage });
      console.log("💬 Balasan terkirim:", replyMessage);
    }
  });
}

connectToWhatsapp();
