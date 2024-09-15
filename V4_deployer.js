import * as utils from "hackUtils.js"
/** @param {NS} ns */
class TargetInfo {
  constructor(ns, target) {
    this.target = target;
    this.maxMoney = ns.getServerMaxMoney(target);
    this.moneyAvailable = ns.getServerMoneyAvailable(target);
    this.minSec = ns.getServerMinSecurityLevel(target);
    this.sec = ns.getServerSecurityLevel(target);
    this.greed = 0.1;
    this.spacer = 1;

    this.times = { hack: 0, weaken1: 0, grow: 0, weaken2: 0 };
    this.threads = { hack: 0, weaken1: 0, grow: 0, weaken2: 0 };
    this.delays = { hack: 0, weaken1: 0, grow: 0, weaken2: 0 }
  }
  calc(ns, greed = this.greed) {
    const maxMoney = this.maxMoney;
    const target = this.target;
    const hTime = ns.getHackTime(target);
    const hSecDecrease = 0.002;
    const gSecDecrease = 0.004;
    const wSecIncrease = 0.05;
    this.moneyAvailable = ns.getServerMoneyAvailable(target);
    this.sec = ns.getServerSecurityLevel(target);
    this.times.hack = hTime;
    this.times.weaken1 = hTime * 4;
    this.times.grow = hTime * 3.2;
    this.times.weaken2 = hTime * 4;
    this.delays.hack = hTime * 4 - hTime;
    this.delays.weaken1 = 0;
    this.delays.grow = hTime * 4 - hTime * 3.2;
    this.delays.weaken2 = 0;
    this.threads.hack = Math.max(Math.ceil(ns.hackAnalyzeThreads(target, maxMoney * greed)), 1);
    this.threads.weaken1 = Math.max(Math.ceil(this.threads.hack * hSecDecrease / wSecIncrease), 1);
    const amountTaken = maxMoney * greed;
    const multFactor = maxMoney / (maxMoney - amountTaken);
    this.threads.grow = Math.max(Math.ceil(ns.growthAnalyze(target, multFactor)), 1);
    this.threads.weaken2 = Math.max(Math.ceil(this.threads.grow * gSecDecrease / wSecIncrease), 1);
  }
}

const TYPES = ["hack", "weaken1", "grow", "weaken2"];
const SCRIPTS = { hack: "/shared/tHack.js", weaken1: "/shared/tWeaken1.js", grow: "/shared/tGrow.js", weaken2: "/shared/tWeaken2.js" };
const COSTS = { hack: 1.70, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };
/** @param {NS} ns */
export async function main(ns) {
  ns.tail();
  ns.disableLog("ALL");
  const port = ns.pid;
  while (true) {
    let batchServers = utils.batchScanner(ns);
    let target = await utils.bestTargetFinder(ns);
    const targetInfo = new TargetInfo(ns, target);
    let offset = 0;
    targetInfo.greed = utils.greedFinder(ns, targetInfo, batchServers);
    ns.print(`Target: ${targetInfo.target}`);
    ns.print(`Amount to be stolen: ${targetInfo.greed * targetInfo.maxMoney }`);
    ns.print(`Greed value: ${targetInfo.greed}`);
    targetInfo.calc(ns);
    utils.batchServerFileCopier(ns, batchServers, SCRIPTS);
    if (!utils.prepChecker(ns, target)) await utils.prep(ns, targetInfo, batchServers, port);
    await ns.sleep(100);
    ns.clearPort(port);
    let batches = await utils.blastingTime(ns, batchServers, targetInfo, TYPES, COSTS, SCRIPTS);
    for (let batch of batches) {
      for (let job in batch) {
        const type = batch[job];
        const threads = type.jobThreads;
        const script = type.script;
        const server = type.server;
        const target = targetInfo.target;
        const delay = type.delay + targetInfo.spacer * offset;
        ns.exec(script, server, { temporary: true, threads: threads, }, target, delay, port);
        offset++;
      }
    }
    let time = ns.tFormat(targetInfo.times.weaken1 + targetInfo.spacer * offset);
    ns.tprint(`All batches deployed. Batches should be finished in approximately ${time}.`);
    let batchesComplete = 0;
    do {
      await ns.nextPortWrite(port);
      ns.clearPort(port);
      batchesComplete++;
      ns.print(`Batch ${batchesComplete} finished`);
    } while (batchesComplete < batches.length);
    ns.tprint(`Batches finished. Calculating for next batch...`);
  }
}
