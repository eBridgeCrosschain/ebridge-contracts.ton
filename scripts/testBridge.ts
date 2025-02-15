import {compile, NetworkProvider} from "@ton/blueprint";
import {Bridge} from "../wrappers/Bridge";
import {Address, beginCell, toNano} from '@ton/core';
import {randomAddress} from "@ton/test-utils";
import bs58 from "bs58";
import {Buffer} from "buffer";
import aelf from "aelf-sdk";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgeSwap} from "../wrappers/BridgeSwap";
import {BridgePool} from "../wrappers/BridgePool";
import {BridgeReceiptAccount} from "../wrappers/BridgeReceiptAccount";


const bridgeAddress = Address.parseFriendly("EQDZV48b9MC5w1DQsUPTZcmKpGzt13sbMvHrWqcQqTQUVdrR");
console.log(bridgeAddress.address);
const add = Address.parseFriendly("EQA8VgxvokmwT7Mc49D8SZQIdn1y3hffeZCXUptZMGR8qDb2");

const bridgePoolAddress = Address.parseFriendly("EQAOWkc0ArTeXP6MkgVx1-Zelk21uRq5flcjwBmw2Tjt5yey");
const nativePoolAddress = Address.parseFriendly("EQBcYW6bUy77wlQFLRBGl2aaYhFgliD_Jfcx7AUPv-ii-Ati");
const bridgeSwapAddress = Address.parseFriendly("EQB6PCFSgqSkv0308G2ZQsZPjS63375DXKQ_Bs_vBiAqSK3l");
const nativeSwapAddress = Address.parseFriendly("EQBun5DRg-z0z9SZiMp6_PaTqtcJSt6pCOTfr_O2tGeMLQuE");
const jettonMinter = Address.parseFriendly("EQBSKUt9k20Gz8RqG71xloqnzcFHt0MdWg1UnWcyU5Xf9CsU");
const testAccount = Address.parseFriendly("EQA8VgxvokmwT7Mc49D8SZQIdn1y3hffeZCXUptZMGR8qDb2");
const nativeToken = Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

const chainId = 1931928;
const targetContract = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";

const chainIdMain = 9992731;
const targetContractMain = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
export async function run(provider: NetworkProvider, args: string[]) {

    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));
    const nativePool = provider.open(BridgePool.createFromAddress(nativePoolAddress.address));
    const bridgeSwap = provider.open(BridgeSwap.createFromAddress(bridgeSwapAddress.address));
    const nativeSwap = provider.open(BridgeSwap.createFromAddress(nativeSwapAddress.address));
    const jetton_minter = provider.open(JettonMinter.createFromAddress(jettonMinter.address));
    console.log(add.address);

    const userWallet = async (address: Address) => provider.open(
        JettonWallet.createFromAddress(
            await jetton_minter.getWalletAddress(address)
        )
    );
    let receipt_amount = BigInt(3000000);
    let forwardAmount = toNano('0.15');
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
    //     toNano('0.2'),
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
    // let code1 = await compile('Bridge');
    // await bridge.sendInitCodeUpgrade(
    //     provider.sender(),
    //     toNano('0.01'),
    //     code1
    // );
    // let code2 = await compile('BridgeSwap');
    // await bridgeSwap.sendInitCodeUpgrade(
    //     provider.sender(),
    //     toNano('0.01'),
    //     code2
    // );
    let code3 = await compile('BridgePool');
    await bridgePool.sendInitCodeUpgrade(
        provider.sender(),
        toNano('0.02'),
        code3
    );
    //
    // await bridge.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    // await bridgeSwap.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    await bridgePool.sendFinalizeUpgradeCode(provider.sender(), toNano('0.02'));

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
}
