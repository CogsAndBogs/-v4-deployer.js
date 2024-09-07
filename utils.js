/** @param {NS} ns */

//Returns a list of all servers, including all purchased servers and the home server.
export function scanner(ns) {
    let servers = [];
    let serversToScan = ns.scan("home");
    while (serversToScan.length > 0) {
      let server = serversToScan.shift();
      if (!servers.includes(server)) {
        servers.push(server);
        serversToScan = serversToScan.concat(ns.scan(server));
      }
    }
    return servers;
  }