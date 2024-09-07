/** @param {NS} ns */
import { scanner } from "utils.js"

/** @param {NS} ns */
//Returns a list of all bought servers, including home, to use in batching.
export function batchScanner(ns) {
  let servers = scanner(ns);
  let batchServers = [];
  for (let server of servers) {
    const serverInfo = getServerInfo(ns, server);
    if (ns.getPurchasedServers().includes(serverInfo.name)) {
      batchServers.push(serverInfo);
    }
  }
  batchServers.sort((x, y) => {
    if (x.maxRam > y.maxRam) return -1;
    if (x.maxRam < y.maxRam) return 1;
  })
  batchServers.push(getServerInfo(ns, "home"))
  return batchServers;

  function getServerInfo(ns, server) {
    return {
      name: server,
      maxRam: ns.getServerMaxRam(server),
      assignedRam: 0,
    }
  }
}


/** @param {NS} ns */
//Copys all relevant files to the batch servers(Because I forgot it LMAO)
export async function batchServerFileCopier(ns, batchServers, SCRIPTS) {
  for (let server of batchServers) {
    let name = server.name;
    for (let script in SCRIPTS) {
      ns.scp(SCRIPTS[script], name, "home");
    }
  }
}

/** @param {NS} ns */
//Uses data from initial server array to give scores to potential targets, Then finds the best target from the map, returning the name of the best target.
export function bestTargetFinder(ns) {
  let servers = scanner(ns);
  const hackableTargets = new Map();
  let hackingLevel = ns.getHackingLevel();
  let maxWeakenTime = (60000 * 15);
  let topServerCalc = 0;
  let bestTarget;
  for (let server of servers) {
    let serverHackingLevel = ns.getServerRequiredHackingLevel(server);
    if (hackingLevel >= serverHackingLevel / 2) {
      let minSecurity = ns.getServerMinSecurityLevel(server);
      let maxMoney = ns.getServerMaxMoney(server);
      let weakenTime = ns.getWeakenTime(server);
      if (ns.hasRootAccess(server) && weakenTime < maxWeakenTime && !ns.getPurchasedServers().includes(server) && server !== "home") {
        let calculations = (100 - minSecurity) * maxMoney * (maxWeakenTime - weakenTime);
        if (calculations !== 0) {
          hackableTargets.set(server, calculations);
        }
      }
    }
  }
  hackableTargets.forEach((calculations, server) => {
    if (calculations >= topServerCalc) {
      topServerCalc = calculations;
      bestTarget = server;
    }
  });

  return bestTarget;
}

/** @param {NS} ns */
//Uses basic data about the target to determine whether or not it is prepped (grown to max, weakened to min).
//Will return a boolean value to be used in a check in the deployer script.
export function prepChecker(ns, target) {
  const secTolerance = 0.001;
  const maxMoney = ns.getServerMaxMoney(target);
  const moneyAvailable = ns.getServerMoneyAvailable(target);
  const minSec = ns.getServerMinSecurityLevel(target);
  const sec = ns.getServerSecurityLevel(target);
  const secFix = sec - minSec < secTolerance;
  return (maxMoney === moneyAvailable && secFix) ? true : false;
}

/** @param {NS} ns */
//Will run a WGW batch(kinda) to get the prep done in the fastest time possible. 
//Should be run before any batching, so no server checking is needed.
//Will run the scripts with the additionalMsec: parameter to line them up. 
export async function prep(ns, targetInfo, batchServers) {
  const batch = {};
  const target = targetInfo.target
  const reservedRam = 256;
  const maxMoney = targetInfo.maxMoney;
  const moneyAvailable = targetInfo.moneyAvailable;
  const minSec = targetInfo.minSec;
  const sec = targetInfo.sec;
  let wThreads1 = Math.ceil((sec - minSec) / 0.05);
  let gThreads = Math.ceil(ns.growthAnalyze(target, maxMoney / moneyAvailable));
  let wThreads2 = Math.ceil(ns.growthAnalyzeSecurity(gThreads) / 0.05);
  let gJobs = 0;
  for (let server of batchServers) {
    let loop = true;
    let name = server.name;
    let maxRam = server.maxRam;
    let ramAvailable;
    if (name === "home") {
      ramAvailable = maxRam - reservedRam;
    } else {
      ramAvailable = maxRam - ns.getServerUsedRam(name);
    }
    let threadsAvailable = Math.floor(ramAvailable / 1.75);
    while (threadsAvailable > 0 && loop) {
      if (wThreads1 <= threadsAvailable && wThreads1 > 0) {
        batch.weaken1 = {
          server: name,
          script: "/shared/tWeaken.js",
          threads: wThreads1,
          delay: 0,
        };
        threadsAvailable -= wThreads1;
        wThreads1 = 0;
      } else if (wThreads2 <= threadsAvailable && wThreads2 > 0) {
        batch.weaken2 = {
          server: name,
          script: "/shared/tWeaken.js",
          threads: wThreads2,
          delay: spacer * 2,
        };
        threadsAvailable -= wThreads2;
        wThreads2 = 0;
      } else if (gThreads > 0) {
        if (gThreads <= threadsAvailable) {
          let growJob = "grow" + String(gJobs);
          batch[growJob] = {
            server: name,
            script: "/shared/tGrow.js",
            threads: gThreads,
            delay: (wTime - gTime + spacer),
          };
          threadsAvailable -= gThreads;
          gThreads = 0;
          gJobs++;
        } else if (gThreads > threadsAvailable) {
          let growJob = "grow" + String(gJobs);
          batch[growJob] = {
            server: name,
            script: "/shared/tGrow.js",
            threads: threadsAvailable,
            delay: (wTime - gTime + spacer),
          };
          gThreads -= threadsAvailable;
          threadsAvailable = 0;
          gJobs++;
        }
      } else {
        loop = false;
      }
    }
  }
  if (wThreads1 !== 0 || gThreads !== 0 || wThreads2 !== 0) {
    throw new Error("Not enough servers available and/or servers not large enough. Something has gone seriously wrong.");
  }
  for (const key in batch) {
    const job = batch[key];
    const server = job.server;
    const script = job.script;
    const threads = job.threads;
    const delay = job.delay;
    ns.exec(script, server, { temporary: true, threads: threads }, targetInfo.target, delay);
  }
  ns.tprint(`Information about prep: `);
  ns.tprint(`Total time to batch: ${(wTime + spacer * 3) / 1000} seconds`);
  ns.tprint(`Weakening from ${sec} to ${minSec}`);
  ns.tprint(`Growing from ${moneyAvailable} to ${maxMoney}`);
  sleepTime = wTime + (spacer * 3);
  await ns.sleep(sleepTime);
  ns.tprint(`Prep complete. Batching can continue.`);
}

/** @param {NS} ns */
//Will find the most efficent batch size for the given target on the basis of the largest amount of ram available. 
//Partially ripped from the batch guide by Dark Technomancer, but everything was handwritten and put into a level I could understand(coding for two months :( ).
//Uses minimum because I want to actually use servers that aren't my home one + I have ambitions for a shotgun batcher, so yeah :3
export async function greedFinder(ns, info, batchServers) {
  let greed = 0.99
  const greedStepValue = 0.01;
  const minGreed = 0.01;
  const target = info.target;
  const reservedRam = 256;
  let smallServer = {
    name: "blank",
    ramAvailable: 10000000000000,
  };
  batchServers.forEach((server) => {
    let name = server.name;
    let maxRam = server.maxRam;
    let ramAvailable;
    if (name === "home") {
      ramAvailable = (maxRam - reservedRam) / 4;
    } else {
      ramAvailable = maxRam - ns.getServerUsedRam(name);
    }
    const serverObject = {
      name: name,
      ramAvailable: ramAvailable,
    }
    if (ramAvailable < smallServer.ramAvailable) {
      smallServer = serverObject;
    }
  });
  const name = smallServer.name;
  //Overestimation for hacks, but required as grow will be as big(or bigger) as hack. 
  const maxThreads = smallServer.ramAvailable / 1.75;
  const maxMoney = info.maxMoney;
  let serverInfo = ns.getServer(name);
  while (greed > minGreed) {
    let amount = maxMoney * greed;
    let multFactor = maxMoney / (maxMoney - amount);
    let gThreads = ns.growthAnalyze(target, multFactor, serverInfo.cpuCores);
    let hThreads = ns.hackAnalyzeThreads(target, amount);
    if (gThreads < maxThreads && hThreads < maxThreads) {
      break;
    }
    greed -= greedStepValue;
  }
  return greed;
}

/*
Here's the big meaty function that will handle my little shotgun. I hope this works, as I never actually tested all my other functions with a normal batcher, lmao. 
Here's the way this thing works:
  Prior to running this function, the TargetInfo.calc is run, adding all the batch goodness to my TargetInfo object. From there, I pass it in as a argument.
  Then, I use the shiny assignedRam section I added to the batchServer function to determine which sections of the ram are unassigned.
  From there, I run a calc to determine how many batches I can fit onto the server, and then I load them into a batches[] array, with each value being an object named Batch, which contains the jobs(IN ORDER, I MIGHT ADD). 
  If a server does not have the space needed 
  It will return this array, which can be used to execute all the batches in a big ass conga line. 
%%%MESSAGE TO MYSELF%%% MAKE SURE YOU RUN THIS INBETWEEN EACH BLAST, AS OTHERWISE IT TAKES UP VALUABLE TIME... %%%MESSAGE TO MYSELF%%%
*/
/** @param {NS} ns */
export async function blastingTime(ns, batchServers, info, TYPES, COSTS, SCRIPTS) {
  const batches = [];
  let servers = batchServers;
  let totalRam = 0;
  const reservedRam = 256;
  for (let server of servers) {
    let maxRam = server.maxRam;
    totalRam += maxRam;
  }
  let batch = testBatch();
  let batchFailed = false;
  do {
    for (let job in batch) {
      const jobThreads = job.jobThreads;
      const ramNeeded = jobThreads * COSTS[job.type];
      const found = false;
      for (let server of servers) {
        const name = server.name;
        const maxRam = server.maxRam;
        const ramAssigned = server.ramAssigned;
        let ramAvailable;
        if (name == "home") {
          ramAvailable = maxRam - ramAssigned - reservedRam;
        } else {
          ramAvailable = maxRam - ramAssigned;
        }
        if (ramAvailable >= ramNeeded) {
          found = true;
          server.ramAssigned += ramNeeded;
          totalRam -= ramNeeded;
          job.server = name;
        }
        if (found == true) break;
      }
      if (found == false) {
        batchFailed = true;
        break;
      }
    }
    batches.push(batch);
  } while (totalRam > 0 || batchFailed == false);

  function testBatch() {
    let batch = {}; 
    for (let type of TYPES) {
      batch[type] = testJob(type);
    }
    return batch;
  }
  function testJob(type) {
    let jobThreads = info.threads[type];
    let delay = info.delays[type];
    return {
      jobThreads: jobThreads,
      delay: delay,
      script: SCRIPTS[type],
      type: type,
    }
  }
  if (batches.length < 1) {
    throw new Error("Not even a single batch has been added. Something has gone terribly wrong.");
  }
  return batches;
}