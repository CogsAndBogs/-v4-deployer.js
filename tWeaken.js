/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  let delay = ns.args[1];
  await ns.weaken(target, { additionalMsec: delay })
}
