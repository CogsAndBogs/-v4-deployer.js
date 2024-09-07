/** @param {NS} ns */
import * as utils from "hackUtils.js"

class TargetInfo {
  constructor(ns, target) {
    this.target = target;
    this.maxMoney = ns.getServerMaxMoney(target);
    this.moneyAvailable = ns.getServerMoneyAvailable(target);
    this.minSec = ns.getServerMinSecurityLevel(target);
    this.sec = ns.getServerSecurityLevel(target);
    this.greed = 0.1;
    this.spacer = 5;

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
    this.threads.hack = Math.ceil(ns.hackAnalyzeThreads(target, maxMoney * greed));
    this.threads.weaken1 = Math.ceil(this.threads.hack * hSecDecrease / wSecIncrease);
    const singleThreadTake = ns.hackAnalyze(target);
    const allThreadTake = singleThreadTake * this.threads.hack;
    const multFactor = maxMoney / (maxMoney - (maxMoney - allThreadTake))
    this.threads.grow = Math.ceil(ns.growthAnalyze(target, multFactor));
    this.threads.weaken2 = Math.ceil(this.threads.grow * gSecDecrease / wSecIncrease);
  }
}

const TYPES = ["hack", "weaken1", "grow", "weaken2"];
const SCRIPTS = { hack: "/shared/tHack.js", weaken1: "/shared/tWeaken1.js", grow: "/shared/tGrow.js", weaken2: "/shared/tWeaken2.js" };
const COSTS = { hack: 1.70, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };
/** @param {NS} ns */
export async function main(ns) {
  let batchServers = utils.batchScanner(ns);
  let target = utils.bestTargetFinder(ns);
  const targetInfo = new TargetInfo(ns, target);
  let offset = 0;
  await utils.batchServerFileCopier(ns, batchServers, SCRIPTS);
  if (!utils.prepChecker(ns, target)) await utils.prep(ns, targetInfo, batchServers);
  targetInfo.greed = await utils.greedFinder(ns, targetInfo, batchServers);
  targetInfo.calc(ns);
  while (true) {
    let batchServers = utils.batchScanner(ns);
    ns.clearPort(ns.pid);
    let batches = await utils.blastingTime(ns, batchServers, targetInfo, TYPES, COSTS, SCRIPTS);
    for (let batch of batches) {
      for (let job in batch) {
        const threads = job.jobThreads;
        const script = job.script;
        const server = job.server;
        const target = targetInfo.target;
        const delay = job.delay + spacer * offset;
        const port = ns.pid;
        ns.exec(script, server, { temporary: true, threads: threads, }, target, delay, port);
        offset++;
      }
    }
    ns.tprint(`All batches deployed. Batches should be finished in approximately ${targetInfo.time.weaken + targetInfo.spacer * offset}.`);
    batches.reverse();
    do {
      await ns.nextPortWrite(ns.pid);
      ns.clearPort(ns.pid);
      batches.pop();
    } while (batches.length > 0);
    ns.tprint(`Batches finished. Calculating for next batch...`);
    let newBatchServers = utils.batchScanner(ns);
    const newTarget = utils.bestTargetFinder(ns);
    if (newTarget !== target) {
      targetInfo.greed = await utils.greedFinder(ns, targetInfo, newBatchServers);
      targetInfo.calc(ns);
    }
  }
}