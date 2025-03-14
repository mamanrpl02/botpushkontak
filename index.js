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

  // Auto-Reply Chat
  socket.ev.on("messages.upsert", async ({ messages }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const msg = messages[0];
    if (!msg.message) return;

    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    const senderNumber = msg.key.remoteJid;
    const isGroup = senderNumber.endsWith("120363411442948382@g.us");

    let replyMessage = null;

    if (isGroup) {
      const participant = msg.key.participant || senderNumber;
      console.log(
        `📩 Pesan grup dari: ${participant} di ${senderNumber} -> ${text}`
      );

      // Cek apakah bot disebut dalam grup
      const botMentioned =
        msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(
          socket.user.id
        );
      if (!botMentioned) return;

      replyMessage = `👥 *Balasan Grup*\nHalo @${
        participant.split("@")[0]
      }, ada yang bisa saya bantu? 😊`;
    } else {
      console.log(`📩 Pesan pribadi dari: ${senderNumber} -> ${text}`);

      switch (text.toLowerCase()) {
        
        case "halo":
        case "hi":
        case "hey":
          replyMessage = `Hai! 😊 Ada yang bisa saya bantu?\n\n> 🤖 Bot WA IG : @manzstore07`;
          break;
        case "menu":
          replyMessage = `📌 *Menu Layanan*\n1️⃣ Cek harga produk\n2️⃣ Info layanan bot\n3️⃣ Bantuan lainnya\n\nKetik angka pilihan Anda.`;
          break;
        case "1":
          replyMessage = `📍 Harga produk:\n💳 Paket A - Rp50.000\n💳 Paket B - Rp100.000\n\nKetik "beli [paket]" untuk membeli.`;
          break;
        case "2":
          replyMessage = `📢 Bot ini bisa membantu Anda:\n✅ Auto-reply chat\n✅ Auto-broadcast\n✅ Integrasi API WhatsApp\n\nKetik "bantuan" untuk info lebih lanjut.`;
          break;
        case "3":
          replyMessage = `Silakan tanyakan apa yang ingin Anda ketahui. Saya siap membantu! 😊`;
          break;
        case `.p${id}`:
          replyMessage = ``;
          break;
        case ".listgroup":
          try {
            const groups = await socket.groupFetchAllParticipating();
            const groupList = Object.values(groups)
              .map((group) => `📌 *${group.subject}* \n ${group.id} \n`)
              .join("\n"); 
            replyMessage = `📋 *Daftar Grup WhatsApp yang anda diikuti:* \n \n ${groupList} \n`;
          } catch (error) {
            replyMessage = "❌ Gagal mengambil daftar grup.";
            console.error("Error mengambil daftar grup:", error);
          }
          break;
      }
    }

    if (replyMessage) {
      await socket.sendMessage(
        senderNumber,
        { text: replyMessage },
        { quoted: msg }
      );
      console.log("💬 Balasan terkirim:", replyMessage);
    }
  });
}

connectToWhatsapp();
