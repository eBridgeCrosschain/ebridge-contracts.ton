import { toNano } from '@ton/core';
import { Bridge } from '../wrappers/Bridge';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const bridge = provider.open(Bridge.createFromConfig({}, await compile('Bridge')));

    await bridge.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(bridge.address);

    // run methods on `ebridgeContractsTon`
}
