const util = require('minecraft-server-util');
const dns = require('dns').promises;

module.exports.config = {
  name: "mc",
  version: "3.1",
  hasPermssion: 0,
  credits: "Helal + Modified by Cyber Sujon",
  description: "Check Minecraft server status (Java & Bedrock)",
  commandCategory: "Utility",
  usages: ".mc <ip> [port]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const threadID = event.threadID;

  if (!args[0]) {
    return api.sendMessage("❌ Please provide a server IP.\nExample: .mc play.hypixel.net", threadID);
  }

  const ip = args[0];
  const port = args[1] ? parseInt(args[1]) : 25565; // default Java

  try {
    let result;

    // Bedrock detection
    if (port === 19132) {
      result = await util.statusBedrock(ip, port, { timeout: 5000 });
    } else {
      result = await util.status(ip, port, { timeout: 5000 });
    }

    // Hosting/IP detection
    let hostResolved = "Unknown";
    try {
      const lookup = await dns.lookup(ip);
      hostResolved = lookup.address;
    } catch (err) {
      if (result.srvRecord && result.srvRecord.host) {
        hostResolved = result.srvRecord.host;
      }
    }

    const reply =
      `🌐 Minecraft Server Status\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📡 Server: ${ip}:${port}\n` +
      `🖥 Hosting: ${hostResolved}\n` +
      `👥 Players: ${result.players.online}/${result.players.max}\n` +
      `⚡ Version: ${result.version.name || result.version}\n` +
      `📝 MOTD: ${result.motd ? result.motd.clean || result.motd : "N/A"}`;

    api.sendMessage(reply, threadID);

  } catch (err) {
    api.sendMessage(`❌ Could not reach server ${ip}:${port}\n(Server may be offline or invalid).`, threadID);
  }
};
