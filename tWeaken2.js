/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    let delay = ns.args[1];
    let port = ns.args[2];
    await ns.weaken(target, { additionalMsec: delay })
    ns.atExit(() => ns.writePort(port, "done"));
  }