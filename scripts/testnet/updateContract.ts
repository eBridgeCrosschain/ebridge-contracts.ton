import {compile, NetworkProvider} from "@ton/blueprint";
import {Bridge} from "../../wrappers/Bridge";
import {Address, toNano} from '@ton/core';
import {BridgePool} from "../../wrappers/BridgePool";


const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const add = Address.parseFriendly("EQA8VgxvokmwT7Mc49D8SZQIdn1y3hffeZCXUptZMGR8qDb2");
const multiSignAddress = Address.parseFriendly("EQBlPNgBLZfD1HhZotqHjhrJVBoIbxCqV2CUvn-U5Qq4CL6P");
const bridgePoolAddress = Address.parseFriendly("kQCOgvqpldcUabiUJdgtHffTy9_-IfvIoZ9Rk26D8q5uVDf9");
const nativePoolAddress = Address.parseFriendly("kQCPfgNN-077aNCCUlKm59ZbDDbwdRfiuOyofEr41sw1KTEC");

export async function run(provider: NetworkProvider, args: string[]) {

    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));
    const nativePool = provider.open(BridgePool.createFromAddress(nativePoolAddress.address));
    
    let code1 = await compile('Bridge');
    await bridge.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.01'),
        code1
    );
    await bridge.sendAdminUpgrade(provider.sender(), toNano('0.01'), multiSignAddress.address);

    let code2 = await compile('BridgePool');
    await bridgePool.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.1'),
        code2
    );

    let code3 = await compile('BridgePool');
    await nativePool.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.1'),
        code3
    );

    await bridge.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    await bridgePool.sendFinalizeUpgradeCode(provider.sender(), toNano('0.02'));
    await nativePool.sendFinalizeUpgradeCode(provider.sender(), toNano('0.02'));


    let res = await bridge.getUpdate();
    let a = res.asSlice();
    let end_code = a.loadUint(64);
    console.log(end_code);
}
