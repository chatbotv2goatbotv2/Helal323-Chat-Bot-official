// mc.js - Minecraft server status (auto-detect Java/Bedrock).
// Put this file into your commands folder and restart the bot.
// Requires: minecraft-server-util, axios
const dns = require("dns").promises;
const mc = require("minecraft-server-util");
const axios = require("axios");

module.exports = {
  config: {
    name: "mc",
    version: "1.0",
    author: "Helal",
    countDown: 5,
    role: 0,
    description: "Check Minecraft server status (auto Java/Bedrock)",
    category: "Utility",
    guide: {
      en: ".mc <host[:port]>   e.g. .mc play.hypixel.net or .mc play.example.net:19132"
    }
  },

  onStart: async function ({ api, event, message, args }) {
    try {
      if (!args || args.length === 0) {
        return message.reply("⚠️ Usage: .mc <host[:port]>\nExample: .mc play.hypixel.net\nOr: .mc play.nethergames.org:19132");
      }

      // parse input: support "host:port" or "host port"
      let input = args[0];
      if (args.length >= 2 && !input.includes(":")) input = `${input}:${args[1]}`;
      let [host, portStr] = input.split(":");
      let port = portStr ? parseInt(portStr) : null;

      // decide default ports: try Java default 25565 unless explicit Bedrock port 19132 given
      // We'll attempt Java first (port or 25565), then fallback to Bedrock (port or 19132)
      const javaPort = port || 25565;
      const bedrockPort = port || 19132;

      await message.reply(`⏳ Checking server: ${host}${port ? ":" + port : ""}  — please wait...`);

      // Helper: detect hosting (simple)
      async function detectHosting(hostname) {
        try {
          const res = await dns.lookup(hostname);
          const ip = res.address || "Unknown IP";
          // simple heuristics by hostname or IP prefix
          const h = hostname.toLowerCase();
          if (h.includes("aternos")) return "Aternos (free)";
          if (h.includes("minehut")) return "Minehut";
          if (h.includes("shockbyte")) return "Shockbyte";
          if (h.includes("pebblehost")) return "PebbleHost";
          if (h.includes("mchost")) return "MCHost"; // generic
          if (ip.startsWith("51.")) return "OVH or Hetzner (Europe)";
          if (ip.startsWith("104.") || ip.startsWith("172.") || ip.startsWith("35.")) return "Cloud Provider / CDN";
          return ip;
        } catch (e) {
          return "Unknown";
        }
      }

      // Try Java status
      try {
        const result = await mc.status(host, javaPort, { timeout: 6000 });
        const hosting = await detectHosting(host);

        const playersOnline = result.players?.online ?? 0;
        const playersMax = result.players?.max ?? "N/A";
        const software = result.software || "Unknown";
        const version = (result.version && (result.version.name || result.version)) || "Unknown";
        // Player list (sample) - may be undefined on big servers
        let playerListText = "No visible player names.";
        if (result.players && Array.isArray(result.players.sample) && result.players.sample.length > 0) {
          const top = result.players.sample.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}`).join("\n");
          playerListText = top;
        }

        const msg =
`🎮 Minecraft Server Info (Java)
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Host: ${host}:${javaPort}
✅ Status: ONLINE
🖥️ Software: ${software}
🎮 Version: ${version}
👥 Players: ${playersOnline}/${playersMax}
📡 Hosting: ${hosting}

👑 Top players (up to 10):
${playerListText}
━━━━━━━━━━━━━━━━━━━━━━━━
✨ Tip: If player names not visible, server may hide sample list.`;

        return message.reply(msg);
      } catch (errJava) {
        // Java failed — try Bedrock
        try {
          const result = await mc.statusBedrock(host, bedrockPort, { timeout: 6000 });
          const hosting = await detectHosting(host);

          const playersOnline = result.players?.online ?? result.playersOnline ?? 0;
          const playersMax = result.players?.max ?? result.playersMax ?? "N/A";
          const version = (result.version && (result.version.name || result.version)) || result.version || "Unknown";
          const edition = result.edition || "Bedrock";

          const msg =
`🎮 Minecraft Server Info (Bedrock)
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Host: ${host}:${bedrockPort}
✅ Status: ONLINE
🖥️ Edition: ${edition}
🎮 Version: ${version}
👥 Players: ${playersOnline}/${playersMax}
📡 Hosting: ${hosting}

⚠️ Note: Bedrock usually does not expose player name list via query.`;

          return message.reply(msg);
        } catch (errBedrock) {
          // Both failed -> offline or unreachable
          // Try mcsrvstat as last resort to see if it has data
          try {
            const res = await axios.get(`https://api.mcsrvstat.us/2/${host}`);
            const data = res.data;
            if (data && data.online) {
              // use available info
              const playersOnline = data.players?.online ?? 0;
              const playersMax = data.players?.max ?? "N/A";
              const motd = data.motd?.clean ? data.motd.clean.join(" ") : "N/A";
              const software = data.software || "Unknown";
              const version = data.version || "Unknown";
              const hosting = await detectHosting(host);

              const msg =
`🎮 Minecraft Server Info (Via mcsrvstat)
━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Host: ${host}
✅ Status: ONLINE (info from mcsrvstat)
🖥️ Software: ${software}
🎮 Version: ${version}
👥 Players: ${playersOnline}/${playersMax}
📡 Hosting: ${hosting}
💬 MOTD: ${motd}
━━━━━━━━━━━━━━━━━━━━━━━━`;

              return message.reply(msg);
            } else {
              return message.reply(`❌ Server is offline or unreachable: ${host}${port ? ":" + port : ""}`);
            }
          } catch (finalErr) {
            return message.reply(`❌ Server is offline or unreachable: ${host}${port ? ":" + port : ""}`);
          }
        }
      }
    } catch (e) {
      console.error(e);
      return message.reply("⚠️ An unexpected error occurred while checking the server.");
    }
  }
};
