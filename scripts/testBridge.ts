import {compile, NetworkProvider} from "@ton/blueprint";
import {Bridge} from "../wrappers/Bridge";
import {Address, beginCell, Dictionary, toNano} from '@ton/core';
import {randomAddress} from "@ton/test-utils";
import bs58 from "bs58";
import {Buffer} from "buffer";
import aelf from "aelf-sdk";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgePool} from "../wrappers/BridgePool";
import {BridgeReceiptAccount} from "../wrappers/BridgeReceiptAccount";


const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
console.log(bridgeAddress.address);
const add = Address.parseFriendly("EQA8VgxvokmwT7Mc49D8SZQIdn1y3hffeZCXUptZMGR8qDb2");

const bridgePoolAddress = Address.parseFriendly("kQCOgvqpldcUabiUJdgtHffTy9_-IfvIoZ9Rk26D8q5uVDf9");
const nativePoolAddress = Address.parseFriendly("kQCPfgNN-077aNCCUlKm59ZbDDbwdRfiuOyofEr41sw1KTEC");
const jettonMinter = Address.parseFriendly("EQBSKUt9k20Gz8RqG71xloqnzcFHt0MdWg1UnWcyU5Xf9CsU");
const testAccount = Address.parseFriendly("0QA0lOMwJ1Unpc3cOLvqHaz7WYYht9MPceAFz4qhpk89Sxek");
const nativeToken = Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

const chainId = 1931928;
const targetContract = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";

const chainIdMain = 9992731;
const targetContractMain = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
export async function run(provider: NetworkProvider, args: string[]) {

    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));
    const nativePool = provider.open(BridgePool.createFromAddress(nativePoolAddress.address));
    const jetton_minter = provider.open(JettonMinter.createFromAddress(jettonMinter.address));
    console.log(add.address);

    const userWallet = async (address: Address) => provider.open(
        JettonWallet.createFromAddress(
            await jetton_minter.getWalletAddress(address)
        )
    );
    let receipt_amount = BigInt(3000000);
    let forwardAmount = toNano('0.1');
    let targetAddress = "ZVJHCVCzixThco58iqe4qnE79pmxeDuYtMsM8k71RhLLxdqB5";
    let targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
    const deployJettonWallet = await userWallet(provider.sender().address!);
    console.log(provider.sender().address!);
    // console.log(targetAddressBuffer.toString('hex'));
    let payload = Bridge.PackCreateReceiptBody(
        chainId, deployJettonWallet.address,
        Buffer.from(targetAddressBuffer), jetton_minter.address);
    // await deployJettonWallet.sendTransfer(
    //     provider.sender(),
    //     toNano('0.15'),
    //     receipt_amount,
    //     bridge.address,
    //     provider.sender().address!,
    //     beginCell().storeUint(0,1).endCell(),
    //     forwardAmount,
    //     payload);

    // let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
    // const buffer = aelf.utils.base58.decode(targetAddress);
    // await bridge.sendTargetContract(provider.sender(), toNano('0.005'), [
    //     {
    //         chain_id: 1931928,
    //         bridge_address: buffer
    //     }]);

    // let target = await bridge.getTargetContractAddress(chainId);
    //
    // console.log(bs58.encode(target));
    //
    let code1 = await compile('Bridge');
    await bridge.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.01'),
        code1
    );

    let code2 = await compile('BridgePool');
    await bridgePool.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.1'),
        code2
    );
    //
    // let code3 = await compile('BridgePool');
    // await nativePool.sendInitCodeUpgrade(
    //     provider.sender(),
    //     toNano('0.1'),
    //     code3
    // );

    await bridge.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    // await bridgeSwap.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    await bridgePool.sendFinalizeUpgradeCode(provider.sender(), toNano('0.02'));
    // await nativePool.sendFinalizeUpgradeCode(provider.sender(), toNano('0.02'));
    
    // await bridge.sendCleanReceiptHash1(provider.sender(), toNano('0.01'));

    // await bridgePool.sendCancelUpgrade(provider.sender(), toNano('0.01'));
    // await bridgeSwap.sendCancelUpgrade(provider.sender(), toNano('0.02'));
    //
    // let code = await compile('BridgeReceiptAccount');
    // await bridge.sendSetReceiptAccount(provider.sender(), toNano('0.01'), code);
    // await bridgePool.sendSetReceiptAccount(provider.sender(), toNano('0.02'), code);
    //
    // let res = await bridge.getUpdate();
    // let a = res.asSlice();
    // let end_code = a.loadUint(64);
    // console.log(end_code);
    //
    // let swap = await bridgePool.getBridgeSwapAddress();
    // console.log(swap);
    //
    // let res = await bridge.get_receipt_hash_two_days_ago();
    // console.log(res.found);
    // console.log(res.dic);
    //
    // let res1 = await bridge.get_receipt_hash(1740561185);
    // console.log(res1.found);
    // console.log(res1.dic);
    
    //
    // let res1 = await bridge.get_receipt_hash(1740182400);
    // console.log(res1.found);
    // console.log(res1.dic);
    //
    // let exist = await bridge.get_receipt_hash_exist(3402906703721786632110540633291984486971845989414150205649244399666043415252n);
    // console.log(exist);
}
