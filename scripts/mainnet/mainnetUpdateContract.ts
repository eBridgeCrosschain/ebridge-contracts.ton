import {compile, NetworkProvider} from "@ton/blueprint";
import {Address, beginCell, OpenedContract, Sender, toNano} from '@ton/core';
import {randomAddress} from "@ton/test-utils";
import bs58 from "bs58";
import {Buffer} from "buffer";
import aelf from "aelf-sdk";
import {BridgePool} from "../../wrappers/BridgePool";
import {Bridge} from "../../wrappers/Bridge";
import {JettonWallet} from "../../wrappers/JettonWallet";
import {BridgePoolLiquidityAccount} from "../../wrappers/BridgePoolLiquidityAccount";
import {JettonMinter} from "../../wrappers/JettonMinter";


const bridgeAddress = Address.parseFriendly("EQBnIw0A17M18zeEHEekgpL32e6yu9cx57PnC990pByv2qJN");
const bridgePoolAddress = Address.parseFriendly("EQBfBX543e7-MXC9iYoq1td_DsMufSqbfHN5L-biMTJqwf-e");

export async function run(provider: NetworkProvider, args: string[]) {
    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));

    let codeBridge = await compile('Bridge');
    await bridge.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.01'),
        codeBridge
    );

    let codeBridgePool = await compile('BridgePool');
    await bridgePool.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.1'),
        codeBridgePool
    );

    await bridge.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    await bridgePool.sendFinalizeUpgradeCode(provider.sender(), toNano('0.02'));
}