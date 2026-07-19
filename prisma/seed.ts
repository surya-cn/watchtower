import "dotenv/config";
import { PrismaClient, Source, Severity, Status } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { randomUUID } from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns a Date that is `daysAgo` days before now. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧹  Cleaning existing data …");

  // Delete in FK-safe order
  await prisma.statusHistory.deleteMany();
  await prisma.rawPost.deleteMany();
  await prisma.issueCluster.deleteMany();
  await prisma.projectAccess.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();

  console.log("✅  Database cleaned");

  // ── Users ──────────────────────────────────────────────────────────────────

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Admin User",
      global_role: "admin",
    },
  });
  
  console.log(`👤  Created user: ${adminUser.email} (admin)`);

  // ── Projects ───────────────────────────────────────────────────────────────

  const javelin = await prisma.project.create({
    data: {
      id: "javelin",
      display_name: "Project Javelin",
      config: {
        sources: [
          // NOTE: This URL is illustrative. A real RSS feed would be needed here now that OAuth is unused.
          { name: "Reddit r/javelin", url: "https://reddit.com/r/Javelin.rss" },
          { name: "Twitter Search", url: "https://api.twitter.com/search?q=javelin" }
        ],
        keywords: {
          include: [
            "aimbot",
            "wallhack",
            "ban",
            "false positive",
            "cheat",
            "hack",
            "exploit",
          ],
          exclude: ["meme", "joke", "offtopic"],
        },
        classification: {
          categories: [
            "aimbot",
            "wallhack",
            "wrongful_ban",
            "hardware",
            "exploit",
            "desync",
          ],
          severity_thresholds: { high: 50, medium: 20 },
        },
        integrations: {
          bug_tracker: "jira",
          bug_tracker_project_key: "JAV",
          webhook_url: null,
        },
        team_contacts: [
          "WatchTower-lead@javelin.dev",
          "security@javelin.dev",
        ],
      },
    },
  });

  const demoTitle = await prisma.project.create({
    data: {
      id: "demo-title",
      display_name: "Demo Title",
      config: {
        sources: [
          // NOTE: This URL is illustrative.
          { name: "Reddit r/DemoTitle", url: "https://reddit.com/r/DemoTitle.rss" }
        ],
        keywords: {
          include: ["aimbot", "wallhack", "cheat", "ban"],
          exclude: ["fan art"],
        },
        classification: {
          categories: ["aimbot", "wallhack", "exploit"],
          severity_thresholds: { high: 30, medium: 10 },
        },
        integrations: {
          bug_tracker: null,
          bug_tracker_project_key: null,
          webhook_url: "https://hooks.example.com/demo",
        },
        team_contacts: ["lead@demotitle.dev"],
      },
    },
  });

  console.log(`📁  Created projects: ${javelin.id}, ${demoTitle.id}`);

  // ── Javelin — Cluster 1: Aimbot false positives ────────────────────────────

  const jCluster1Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: jCluster1Id,
      project_id: "javelin",
      title: "Aimbot detection false positives after v3.2 update",
      category: "aimbot",
      severity: Severity.high,
      status: Status.escalated,
      post_count: 8,
      first_reported_at: daysAgo(10),
      last_reported_at: daysAgo(2),
    },
  });

  const jC1Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_ab12c1",
      author: "xFrag_King",
      content:
        "Got banned for aimbot after the v3.2 patch but I've never cheated. My aim was just on point that game. This is insane, false positive for sure.",
      url: "https://reddit.com/r/WatchTower/comments/ab12c1/false_positive_aimbot_v32",
      posted_at: daysAgo(10),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_ab12c2",
      author: "SniperElite99",
      content:
        "Same here — played 3 rounds of ranked and got flagged for aimbot. I've been playing this game since beta, never used any cheats. The new WatchTower is way too aggressive.",
      url: "https://reddit.com/r/Javelin/comments/ab12c2/aimbot_false_ban_wave",
      posted_at: daysAgo(9),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382910001",
      author: "@ProGamerJen",
      content:
        "Just got hit with an aimbot ban on Javelin after the v3.2 update. I stream every session — go watch the VOD, no cheats. Fix your WatchTower! #JavelinAC #FalsePositive",
      url: "https://twitter.com/ProGamerJen/status/17382910001",
      posted_at: daysAgo(8),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_882001",
      author: "ChillGamer_42",
      content:
        "Posted a negative review because of false aimbot detection. v3.2 completely broke the detection — multiple friends also banned. We all play legit.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/882001",
      posted_at: daysAgo(7),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_ab12c3",
      author: "CompetitiveAndy",
      content:
        "My account got flagged for aimbot after a 30-kill game. Has anyone else experienced this since the 3.2 patch? Feels like the sensitivity threshold is way too low now.",
      url: "https://reddit.com/r/gamehacking/comments/ab12c3/javelin_false_aimbot",
      posted_at: daysAgo(6),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382910002",
      author: "@FPSWatchdog",
      content:
        "Multiple reports coming in of false aimbot detections in Javelin post-v3.2. Looks like the new heuristic model is flagging high-sens players. Needs a hotfix ASAP.",
      url: "https://twitter.com/FPSWatchdog/status/17382910002",
      posted_at: daysAgo(5),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_882002",
      author: "TacticalTuna",
      content:
        "I was in the middle of a tournament match and got kicked + temp banned for aimbot. This is the third time since the v3.2 update. Please investigate, my stats are normal.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/882002",
      posted_at: daysAgo(3),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_ab12c4",
      author: "NightOwl_FPS",
      content:
        "Update: just got unbanned after appealing, but the whole process took 5 days. Devs confirmed it was a false positive from the v3.2 aimbot detector. They really need to fix this.",
      url: "https://reddit.com/r/Javelin/comments/ab12c4/unbanned_false_positive_confirmed",
      posted_at: daysAgo(2),
    },
  ];

  for (const p of jC1Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster1Id,
        ...p,
      },
    });
  }

  // Status history for cluster 1
  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster1Id,
        status: Status.new,
        changed_at: daysAgo(10),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster1Id,
        status: Status.active,
        changed_at: daysAgo(7),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster1Id,
        status: Status.escalated,
        changed_at: daysAgo(3),
      },
    ],
  });

  // ── Javelin — Cluster 2: Wallhack reports Dustyard ─────────────────────────

  const jCluster2Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: jCluster2Id,
      project_id: "javelin",
      title: "Wallhack reports on map Dustyard",
      category: "wallhack",
      severity: Severity.medium,
      status: Status.active,
      post_count: 5,
      first_reported_at: daysAgo(14),
      last_reported_at: daysAgo(5),
    },
  });

  const jC2Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_wh20a1",
      author: "DustyardMain",
      content:
        "I've been killed through walls on Dustyard at least 4 times today. The enemy always knows exactly where I am even when there's no UAV up. Wallhack is rampant on this map.",
      url: "https://reddit.com/r/Javelin/comments/wh20a1/dustyard_wallhack_epidemic",
      posted_at: daysAgo(14),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_883001",
      author: "MapExplorer_X",
      content:
        "Recorded a clip where a player tracked me through three solid walls on Dustyard. Uploaded to YouTube. This is clearly wallhack and the WatchTower didn't catch it.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/883001",
      posted_at: daysAgo(12),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382920001",
      author: "@JavelinReport",
      content:
        "Dustyard is literally unplayable right now. Wallhackers in every other lobby. @JavelinOfficial when are you going to address this? #JavelinAC",
      url: "https://twitter.com/JavelinReport/status/17382920001",
      posted_at: daysAgo(10),
    },
    {
      source: Source.discord,
      source_post_id: "disc_msg_440001",
      author: "GhostRecon#8821",
      content:
        "Just encountered another wallhacker on Dustyard ranked. They pre-aimed every corner. Reported in-game but nothing happened. Is the WatchTower even scanning for ESP?",
      url: "https://discord.com/channels/123456789/987654321/440001",
      posted_at: daysAgo(7),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_wh20a2",
      author: "TrustTheProcess",
      content:
        "Dustyard wallhack issue is getting worse. Played 10 games today and at least 3 had suspicious players who could see through walls. The geometry on that map might be leaking player positions.",
      url: "https://reddit.com/r/WatchTower/comments/wh20a2/dustyard_wallhack_still_happening",
      posted_at: daysAgo(5),
    },
  ];

  for (const p of jC2Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster2Id,
        ...p,
      },
    });
  }

  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster2Id,
        status: Status.new,
        changed_at: daysAgo(14),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster2Id,
        status: Status.active,
        changed_at: daysAgo(10),
      },
    ],
  });

  // ── Javelin — Cluster 3: Wrongful bans HWID ───────────────────────────────

  const jCluster3Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: jCluster3Id,
      project_id: "javelin",
      title: "Wrongful bans from hardware ID mismatch",
      category: "wrongful_ban",
      severity: Severity.high,
      status: Status.new,
      post_count: 10,
      first_reported_at: daysAgo(3),
      last_reported_at: daysAgo(1),
    },
  });

  const jC3Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_hwid01",
      author: "BannedForNothing",
      content:
        "Got a hardware ban after upgrading my GPU. Javelin's HWID system thinks I'm a new machine trying to evade a ban. I've never been banned before!",
      url: "https://reddit.com/r/Javelin/comments/hwid01/hwid_ban_after_gpu_upgrade",
      posted_at: daysAgo(3),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_hwid02",
      author: "PCBuilder_2025",
      content:
        "Same issue here. Swapped my motherboard and now I'm hardware banned. The HWID fingerprint changed and their system flagged me as a ban evader. This is absurd.",
      url: "https://reddit.com/r/WatchTower/comments/hwid02/hwid_mismatch_wrongful_ban",
      posted_at: daysAgo(3),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_884001",
      author: "LegitPlayer_One",
      content:
        "Hardware banned from Javelin after a BIOS update. My hardware ID changed and now the game thinks I'm cheating. Support hasn't responded in 48 hours.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/884001",
      posted_at: daysAgo(3),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382930001",
      author: "@HWIDVictim",
      content:
        "Javelin just hardware banned me for changing my RAM. Apparently swapping 16GB to 32GB makes you a cheater now. @JavelinOfficial fix your HWID detection! #WrongfulBan",
      url: "https://twitter.com/HWIDVictim/status/17382930001",
      posted_at: daysAgo(3),
    },
    {
      source: Source.discord,
      source_post_id: "disc_msg_450001",
      author: "TechSavvy#1234",
      content:
        "Multiple people in our clan got HWID banned after Windows updates changed their hardware fingerprints. This is a systematic issue with the detection logic.",
      url: "https://discord.com/channels/123456789/987654321/450001",
      posted_at: daysAgo(2),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_hwid03",
      author: "CleanRecord99",
      content:
        "I've been playing Javelin since launch with a clean record. Got a new SSD, reinstalled Windows, and now I'm hardware banned. The HWID system is fundamentally broken.",
      url: "https://reddit.com/r/Javelin/comments/hwid03/new_ssd_hwid_ban",
      posted_at: daysAgo(2),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_884002",
      author: "FrustratedGamer",
      content:
        "This HWID ban wave is ridiculous. I checked the forums and dozens of people are reporting the same thing — hardware changes triggering false bans. The detection needs a complete overhaul.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/884002",
      posted_at: daysAgo(2),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382930002",
      author: "@GamingRights",
      content:
        "Thread: Javelin's HWID ban system is catching innocent players who simply upgraded their PCs. At least 50 reports in the last 3 days. This needs immediate attention. 1/5",
      url: "https://twitter.com/GamingRights/status/17382930002",
      posted_at: daysAgo(2),
    },
    {
      source: Source.ea_forum,
      source_post_id: "ea_post_990001",
      author: "WatchTowerResearcher",
      content:
        "Technical analysis: Javelin's HWID fingerprinting relies on a combination of CPU ID, GPU serial, and disk serial. Any change to 2+ components triggers a ban evasion flag. This threshold is too aggressive.",
      url: "https://forums.ea.com/discussions/990001/javelin-hwid-analysis",
      posted_at: daysAgo(1),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_hwid04",
      author: "VoiceOfReason",
      content:
        "PSA: If you got wrongfully HWID banned from Javelin, submit a ticket with your purchase receipts for new hardware. Some people are getting unbanned after proving they upgraded components.",
      url: "https://reddit.com/r/Javelin/comments/hwid04/psa_hwid_ban_appeal_process",
      posted_at: daysAgo(1),
    },
  ];

  for (const p of jC3Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster3Id,
        ...p,
      },
    });
  }

  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster3Id,
        status: Status.new,
        changed_at: daysAgo(3),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster3Id,
        status: Status.new,
        note: "Investigating HWID detection logic",
        changed_at: daysAgo(2),
      },
    ],
  });

  // ── Javelin — Cluster 4: Desync exploit ────────────────────────────────────

  const jCluster4Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: jCluster4Id,
      project_id: "javelin",
      title: "Desync exploit in ranked lobbies",
      category: "desync",
      severity: Severity.low,
      status: Status.fixed,
      post_count: 3,
      first_reported_at: daysAgo(30),
      last_reported_at: daysAgo(15),
    },
  });

  const jC4Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_desync01",
      author: "RankedWarrior",
      content:
        "Found a desync exploit in ranked — if you alt-tab at exactly the right time during matchmaking, your character desyncs from the server and you become unhittable for about 10 seconds.",
      url: "https://reddit.com/r/Javelin/comments/desync01/desync_exploit_ranked",
      posted_at: daysAgo(30),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_885001",
      author: "NetcodeNerd",
      content:
        "The desync exploit in ranked is being abused hard. Players are intentionally causing packet loss to trigger invincibility frames. Seen it in 3 matches today.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/885001",
      posted_at: daysAgo(22),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382940001",
      author: "@CompetitiveJav",
      content:
        "The desync exploit is ruining ranked. People are abusing it to win gunfights by becoming temporarily invulnerable. @JavelinOfficial please patch this ASAP.",
      url: "https://twitter.com/CompetitiveJav/status/17382940001",
      posted_at: daysAgo(15),
    },
  ];

  for (const p of jC4Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster4Id,
        ...p,
      },
    });
  }

  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster4Id,
        status: Status.new,
        changed_at: daysAgo(30),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster4Id,
        status: Status.active,
        changed_at: daysAgo(25),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster4Id,
        status: Status.fixed,
        note: "Fix shipped in patch 2.4",
        changed_at: daysAgo(15),
      },
    ],
  });

  // ── Javelin — Cluster 5: Speed hack false positive ─────────────────────────

  const jCluster5Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: jCluster5Id,
      project_id: "javelin",
      title: "Speed hack exploit on competitive servers",
      category: "exploit",
      severity: Severity.medium,
      status: Status.closed_false_positive,
      post_count: 4,
      first_reported_at: daysAgo(20),
      last_reported_at: daysAgo(12),
    },
  });

  const jC5Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_speed01",
      author: "SpeedDemon_X",
      content:
        "Encountered a player moving at 2x speed on the competitive server. Looked like a speed hack — they were zooming across the map and impossible to hit.",
      url: "https://reddit.com/r/Javelin/comments/speed01/speed_hack_competitive",
      posted_at: daysAgo(20),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_886001",
      author: "FairPlayAdvocate",
      content:
        "Reporting a speed hack on competitive servers. One player was running at inhuman speeds. Clip attached in the Steam discussion thread. WatchTower didn't flag them.",
      url: "https://store.steampowered.com/app/112233/Javelin/#discussions/0/886001",
      posted_at: daysAgo(18),
    },
    {
      source: Source.discord,
      source_post_id: "disc_msg_460001",
      author: "Sentinel#5500",
      content:
        "Saw what looked like speed hacking on the EU competitive servers. The player was rubber-banding and moving way faster than normal. Could be lag though — hard to tell.",
      url: "https://discord.com/channels/123456789/987654321/460001",
      posted_at: daysAgo(15),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_17382950001",
      author: "@JavEsports",
      content:
        "Multiple reports of 'speed hacking' on competitive Javelin servers. After investigating, this looks more like severe rubber-banding from high-latency players, not actual exploits.",
      url: "https://twitter.com/JavEsports/status/17382950001",
      posted_at: daysAgo(11),
    },
  ];

  for (const p of jC5Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster5Id,
        ...p,
      },
    });
  }

  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster5Id,
        status: Status.new,
        changed_at: daysAgo(20),
      },
      {
        id: randomUUID(),
        project_id: "javelin",
        cluster_id: jCluster5Id,
        status: Status.closed_false_positive,
        note: "Confirmed as network lag, not actual exploit",
        changed_at: daysAgo(12),
      },
    ],
  });

  // ── Demo Title — Cluster 1: Aimbot in casual ──────────────────────────────

  const dCluster1Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: dCluster1Id,
      project_id: "demo-title",
      title: "Suspected aimbot in casual mode",
      category: "aimbot",
      severity: Severity.high,
      status: Status.new,
      post_count: 4,
      first_reported_at: daysAgo(5),
      last_reported_at: daysAgo(2),
    },
  });

  const dC1Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_demo_ab01",
      author: "CasualFan_22",
      content:
        "Just played a casual match in Demo Title and someone was blatantly aimbotting. Every single headshot, no recoil, snapping to targets instantly. Reported but nothing happened.",
      url: "https://reddit.com/r/DemoTitle/comments/demo_ab01/aimbot_casual_mode",
      posted_at: daysAgo(5),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_dt_001",
      author: "NewPlayerHere",
      content:
        "I'm new to Demo Title and already running into aimbotters in casual. Is this normal? The guy had 50 kills and 0 deaths. Completely ruined the experience.",
      url: "https://store.steampowered.com/app/445566/DemoTitle/#discussions/0/dt_001",
      posted_at: daysAgo(4),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_demo_ab02",
      author: "DT_Veteran",
      content:
        "Aimbot problem in casual is getting out of hand. Played 5 games tonight, 3 of them had obvious aimbotters. The WatchTower needs to be more aggressive in casual mode too, not just ranked.",
      url: "https://reddit.com/r/DemoTitleAC/comments/demo_ab02/casual_aimbot_wave",
      posted_at: daysAgo(3),
    },
    {
      source: Source.twitter,
      source_post_id: "tw_dt_17382960001",
      author: "@DemoTitleNews",
      content:
        "Reports flooding in about aimbot usage in Demo Title casual mode. The free-to-play weekend seems to have attracted a wave of cheaters. @DemoTitleDev please respond.",
      url: "https://twitter.com/DemoTitleNews/status/17382960001",
      posted_at: daysAgo(2),
    },
  ];

  for (const p of dC1Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "demo-title",
        cluster_id: dCluster1Id,
        ...p,
      },
    });
  }

  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "demo-title",
        cluster_id: dCluster1Id,
        status: Status.new,
        changed_at: daysAgo(5),
      },
      {
        id: randomUUID(),
        project_id: "demo-title",
        cluster_id: dCluster1Id,
        status: Status.new,
        note: "Monitoring report volume from free-to-play weekend",
        changed_at: daysAgo(3),
      },
    ],
  });

  // ── Demo Title — Cluster 2: Wallhack on tutorial map ──────────────────────

  const dCluster2Id = randomUUID();
  await prisma.issueCluster.create({
    data: {
      id: dCluster2Id,
      project_id: "demo-title",
      title: "Wallhack reports on tutorial map",
      category: "wallhack",
      severity: Severity.medium,
      status: Status.active,
      post_count: 3,
      first_reported_at: daysAgo(7),
      last_reported_at: daysAgo(3),
    },
  });

  const dC2Posts = [
    {
      source: Source.reddit,
      source_post_id: "t3_demo_wh01",
      author: "TutorialTester",
      content:
        "Found a player using wallhacks on the tutorial map in Demo Title. They were shooting through walls that should be solid. Even the tutorial isn't safe from cheaters.",
      url: "https://reddit.com/r/DemoTitle/comments/demo_wh01/wallhack_tutorial_map",
      posted_at: daysAgo(7),
    },
    {
      source: Source.steam,
      source_post_id: "steam_disc_dt_002",
      author: "QA_Minded",
      content:
        "The tutorial map in Demo Title seems to have a rendering issue where player models clip through certain walls. Not sure if it's an actual wallhack or a map bug, but people are abusing it either way.",
      url: "https://store.steampowered.com/app/445566/DemoTitle/#discussions/0/dt_002",
      posted_at: daysAgo(5),
    },
    {
      source: Source.reddit,
      source_post_id: "t3_demo_wh02",
      author: "MapDesignFan",
      content:
        "The wallhack issue on the tutorial map might actually be a geometry bug. Some walls have thin spots where player outlines are visible. Still needs to be fixed regardless.",
      url: "https://reddit.com/r/DemoTitleAC/comments/demo_wh02/tutorial_wall_bug_or_hack",
      posted_at: daysAgo(3),
    },
  ];

  for (const p of dC2Posts) {
    await prisma.rawPost.create({
      data: {
        id: randomUUID(),
        project_id: "demo-title",
        cluster_id: dCluster2Id,
        ...p,
      },
    });
  }

  await prisma.statusHistory.createMany({
    data: [
      {
        id: randomUUID(),
        project_id: "demo-title",
        cluster_id: dCluster2Id,
        status: Status.new,
        changed_at: daysAgo(7),
      },
      {
        id: randomUUID(),
        project_id: "demo-title",
        cluster_id: dCluster2Id,
        status: Status.active,
        changed_at: daysAgo(4),
      },
    ],
  });

  // ── Summary ────────────────────────────────────────────────────────────────

  const clusterCount = await prisma.issueCluster.count();
  const postCount = await prisma.rawPost.count();
  const historyCount = await prisma.statusHistory.count();

  console.log(`\n🌱  Seed complete!`);
  console.log(`    Projects:        2`);
  console.log(`    Issue clusters:  ${clusterCount}`);
  console.log(`    Raw posts:       ${postCount}`);
  console.log(`    Status history:  ${historyCount}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
