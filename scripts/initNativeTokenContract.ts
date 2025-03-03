import {compile, NetworkProvider} from "@ton/blueprint";
import {Bridge, TargetContractConfig} from "../wrappers/Bridge";
import {Address, beginCell, OpenedContract, Sender, toNano} from '@ton/core';
import {randomAddress} from "@ton/test-utils";
import bs58 from "bs58";
import {Buffer} from "buffer";
import aelf from "aelf-sdk";
import {BridgePool} from "../wrappers/BridgePool";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgeSwap} from "../wrappers/BridgeSwap";
import {BridgeReceiptAccount} from "../wrappers/BridgeReceiptAccount";
import {BridgePoolLiquidityAccount} from "../wrappers/BridgePoolLiquidityAccount";


const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const nativePoolAddress = Address.parseFriendly("kQCPfgNN-077aNCCUlKm59ZbDDbwdRfiuOyofEr41sw1KTEC");
const nativeToken = Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

const chainId = 1931928;
const targetContract = "293dHYMKjfEuTEkveb5h775avTyW69jBgHMYiWQqtdSdTfsfEP";

const chainIdMain = 9992731;
const targetContractMain = "2rC1X1fudEkJ4Yungj5tYNJ93GmBxbSRiyJqfBkzcT6JshSqz9";

export async function run(provider: NetworkProvider, args: string[]) {
    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const nativePool = provider.open(BridgePool.createFromAddress(nativePoolAddress.address));
    
    const admin = provider.sender();

    // // 1. create native swap
    // await createSwap(nativePool, admin);
    //
    // // 2. set bridge
    // await setBridge(nativePool, admin, bridge.address);
    //
    // // 3. set daily limit
    // await setDailyLimit(nativePool, admin, toNano('1000'), chainId, getUTCMidnight());
    // // 4. set rate limit
    // await setRateLimit(nativePool, admin, toNano('1000'), toNano('100'), chainId);
    // // 10 .get config
    // let isSupport = await bridge.getIsJettonSupport(chainId, jettonMinter.address);
    // console.log(isSupport);
    // // get bridge swap
    // let swap = await bridge.getBridgeSwap(jettonMinter.address);
    // console.log(swap);
    // // get pool
    // let pool = await bridge.getBridgePool(jettonMinter.address);
    // console.log(pool);
    // let targetContractAddress = await bridge.getTargetContractAddress(chainIdMain);
    // console.log(aelf.utils.base58.encode(targetContractAddress));
    // targetContractAddress = await bridge.getTargetContractAddress(chainId);
    // console.log(aelf.utils.base58.encode(targetContractAddress));
    // get swap info
    let swapInfo = await nativePool.getSwapData(chainId);
    // swapId:6akJ+WNN/7uYAH2YHHjbc11djaEkxzpWPI9gK/jdDns=
    let hex = swapInfo.swapId.toString(16);
    if (hex.length % 2) hex = '0' + hex; 
    const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
    let swapId = Buffer.from(bytes).toString('base64');
    console.log(swapId);
    console.log(swapInfo.swapId);
    console.log(swapInfo.fromChainId);
    console.log(swapInfo.originShare);
    console.log(swapInfo.targetShare);
    console.log(swapInfo.swappedAmount);
    console.log(swapInfo.swappedTimes);
    // get swap info
    let swapInfoMain = await nativePool.getSwapData(chainIdMain);
    let hex1 = swapInfoMain.swapId.toString(16);
    if (hex1.length % 2) hex1 = '0' + hex1;
    const bytes1 = Uint8Array.from(Buffer.from(hex1, 'hex'));
    let swapId1 = Buffer.from(bytes1).toString('base64');
    console.log(swapId1);
    console.log(swapInfoMain.fromChainId);
    console.log(swapInfoMain.originShare);
    console.log(swapInfoMain.targetShare);
    console.log(swapInfoMain.swappedAmount);
    console.log(swapInfoMain.swappedTimes);
    // // get bridge
    // let bridgeGet = await bridgePool.getBridgeAddress();
    // console.log(bridgeGet);
    // // get bridge swap
    // let bridgeswapget = await bridgePool.getBridgeSwapAddress();
    // console.log(bridgeswapget);
    // // get jetton
    // let jetton = await bridgePool.getJettonAddress();
    // console.log(jetton.jettonAddress);
    // console.log(jetton.poolJettonWalletAddress);
    // get daily limit
    // let dailyLimit = await bridgePool.getReceiptDailyLimit(chainId);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // // get rate limit
    // let rateLimit = await bridgePool.getReceiptRateLimit(chainId);
    // console.log(rateLimit.tokenCapacity);
    // console.log(rateLimit.rate);
    // console.log(rateLimit.currentTokenAmount);
    // console.log(rateLimit.isEnable);
    // console.log(rateLimit.refreshTime);
    // // get daily limit
    // dailyLimit = await bridgePool.getSwapDailyLimit(chainId);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // get rate limit
    // var rateLimit = await bridgePool.getSwapRateLimit(chainId);
    // console.log(rateLimit.tokenCapacity);
    // console.log(rateLimit.rate);
    // console.log(rateLimit.currentTokenAmount);
    // console.log(rateLimit.isEnable);
    // console.log(rateLimit.refreshTime);

    // console.log(getUTCMidnight());
    // // get daily limit
    // let dailyLimit = await bridgePool.getReceiptDailyLimit(chainId);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // // get rate limit
    // let rateLimit = await bridgePool.getReceiptRateLimit(chainIdMain);
    // console.log(rateLimit.tokenCapacity);
    // console.log(rateLimit.rate);
    // console.log(rateLimit.currentTokenAmount);
    // console.log(rateLimit.isEnable);
    // console.log(rateLimit.refreshTime);
    // get daily limit
    // let dailyLimit = await bridgePool.getSwapDailyLimit(chainId);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // // get rate limit
    // let rateLimit = await bridgePool.getSwapRateLimit(chainId);
    // console.log(rateLimit.tokenCapacity);
    // console.log(rateLimit.rate);
    // console.log(rateLimit.currentTokenAmount);
    // console.log(rateLimit.isEnable);
    // console.log(rateLimit.refreshTime);

    // // add jetton liquidity
    // let amount_add_liquidity = 100000000n;
    // let forwardAmount = toNano('0.1');
    // let payload = BridgePool.packAddLiquidityBody();
    // await deployJettonWallet.sendTransfer(
    //     admin,
    //     toNano('0.15'),
    //     amount_add_liquidity,
    //     bridgePool.address,
    //     provider.sender().address!,
    //     beginCell().storeUint(0,1).endCell(),
    //     forwardAmount,
    //     payload);
    // await nativePool.sendAddNativeLiquidity(provider.sender(), toNano('0.6'), toNano('0.5'));
    
    // // remove jetton liquidity
    // let amount_remove_liquidity = 100000000n;
    // let fee = toNano('0.1');
    // const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(admin.address!);
    // let usr_liq = provider.open(BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
    // await usr_liq.sendRemoveLiquidity(admin,fee,amount_remove_liquidity);


    // const liquidity_account = await bridgePool.getPoolLiquidityAccountAddress(provider.sender().address!);
    // console.log(liquidity_account);
    // let liquidityAfter = await bridgePool.getPoolLiquidity();
    // console.log(liquidityAfter);
    //
    // const bridgeReceiptAccountAddress = await bridgePool.getReceiptAddress(provider.sender().address!);
    // console.log(bridgeReceiptAccountAddress);
    // let receipt = provider.open(BridgeReceiptAccount.createFromAddress(bridgeReceiptAccountAddress));
    // let receiptInfo = await receipt.getReceiptInfo(chainIdMain);
    // console.log(receiptInfo);
    //
    // let bridgeReceiptAccountAddress1 = await bridgePool.getReceiptAddress(Address.parseFriendly("0QA0lOMwJ1Unpc3cOLvqHaz7WYYht9MPceAFz4qhpk89Sxek").address);
    // console.log(bridgeReceiptAccountAddress1);
    // receipt = provider.open(BridgeReceiptAccount.createFromAddress(bridgeReceiptAccountAddress1));
    // receiptInfo = await receipt.getReceiptInfo(chainIdMain);
    // console.log(receiptInfo);

    // await bridge.sendPause(admin, toNano('0.01'));
    // const status = await bridge.getPaused();
    // console.log(status);

    // await bridge.sendRestart(admin, toNano('0.01'));


    // await bridgePool.sendSetRateLimit(
    //     admin,
    //     toNano('0.03'),
    //     [{
    //         chainId: chainId,
    //         limitType: 1,
    //         tokenCapacity: BigInt(10000000),
    //         rate: BigInt(10000),
    //     }]);
    //
    // let refreshTime = getUTCMidnight();
    // await bridgePool.sendSetDailyLimit(
    //     admin,
    //     toNano('0.02'),
    //     [{
    //         chainId: chainId,
    //         limitType: 1,
    //         refreshTime: refreshTime,
    //         dailyLimit: BigInt(15000000)
    //     }]);

}

async function createSwap(bridgePool: OpenedContract<BridgePool>, admin: Sender) {
    await bridgePool.sendCreateSwap(
        admin, toNano('0.01'), [{
            fromChainId: chainId,
            originShare: 1,
            targetShare: 1
        },
            {
                fromChainId: chainIdMain,
                originShare: 1,
                targetShare: 1
            }]);
}

async function setBridge(bridgePool: OpenedContract<BridgePool>, admin: Sender, bridgeAddress: Address) {
    await bridgePool.sendSetBridge(admin, toNano('0.01'), bridgeAddress);
}

async function setBridgePoolSwap(bridgePool: OpenedContract<BridgePool>, admin: Sender, swap: Address) {
    await bridgePool.sendSetBridgeSwap(admin, toNano('0.004'), swap);
}

async function setJetton(bridgePool: OpenedContract<BridgePool>, admin: Sender, bridgePoolJettonWallet: Address) {
    await bridgePool.sendSetJetton(admin, toNano('0.01'), bridgePoolJettonWallet);
}

async function setDailyLimit(bridgePool: OpenedContract<BridgePool>, admin: Sender, dailyLimit: bigint, chainId: number, refreshTime: number) {
    await bridgePool.sendSetDailyLimit(
        admin,
        toNano('0.02'),
        [{
            chainId: chainId,
            limitType: 0,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        }, {
            chainId: chainId,
            limitType: 1,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        },
            {
                chainId: chainIdMain,
                limitType: 0,
                refreshTime: refreshTime,
                dailyLimit: dailyLimit
            }, {
            chainId: chainIdMain,
            limitType: 1,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        }]);
}

async function setRateLimit(bridgePool: OpenedContract<BridgePool>, admin: Sender, capacity: bigint, rateLimit: bigint, chainId: number) {
    await bridgePool.sendSetRateLimit(
        admin,
        toNano('0.03'),
        [{
            chainId: chainId,
            limitType: 0,
            tokenCapacity: capacity,
            rate: rateLimit,
        },
            {
                chainId: chainId,
                limitType: 1,
                tokenCapacity: capacity,
                rate: rateLimit,
            }, {
            chainId: chainIdMain,
            limitType: 0,
            tokenCapacity: capacity,
            rate: rateLimit,
        },
            {
                chainId: chainIdMain,
                limitType: 1,
                tokenCapacity: capacity,
                rate: rateLimit,
            }]);
}

function getUTCMidnight(): number {
    const now = new Date();
    // Create a new Date object for today's midnight in UTC
    let time = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    console.log(time);
    return time / 1000;
}