const { basename, extname, join } = require('path');
const { existsSync, readdirSync, readFileSync } = require('fs');

const { NETWORK: network } = process.env;
if (!network) throw new Error('network not set');

const dir = `node_modules/@exactly/protocol/deployments/${network}/`;
const deployments = readdirSync(dir).filter((file) => extname(file) === '.json');

/** @type {function(string): Deployment} */
const get = (name) => JSON.parse(readFileSync(join(dir, `${name}.json`)).toString());

/** @type {function(Deployment, string): { name: string, address: string, startBlock?: number }} */
const from = ({ address, receipt }, name) => ({ name, address, startBlock: receipt?.blockNumber });

module.exports = {
  graphNetwork: {
    ethereum: 'mainnet',
    'op-sepolia': 'optimism-sepolia',
  }[network] ?? network,
  network,
  Auditor: from(get('Auditor'), 'Auditor'),
  RewardsController: existsSync(join(dir, 'RewardsController.json')) ? from(get('RewardsController'), 'RewardsController') : undefined,
  Market: deployments.map((file) => {
    const name = basename(file, '.json');
    if (!name.startsWith('Market') || name.includes('_') || name.includes('Router')) return null;

    const deployment = get(name);
    if (deployment.args && deployment.args.length < 2) return null;

    return from(deployment, name);
  }).filter(Boolean),
  TimelockController: from(get('TimelockController'), 'TimelockController'),
  StakedEXA: from(get('stEXA'), 'stEXA'),
};

/** @typedef {{ address: string, receipt?: { blockNumber?: number }, args?: any[] }} Deployment */
