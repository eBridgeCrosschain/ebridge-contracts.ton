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


const bridgeAddress = Address.parseFriendly("");
const bridgePoolAddress = Address.parseFriendly("");
const usdtAddress = Address.parseFriendly("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");

const chainIdSide = 1866392;
const targetContractSide = "GZs6wyPDfz3vdEmgVd3FyrQfaWSXo9uRvc7Fbp5KSLKwMAANd";

const chainIdMain = 9992731;
const targetContractMain = "2dKF3svqDXrYtA5mYwKfADiHajo37mLZHPHVVuGbEDoD9jSgE8";

export async function run(provider: NetworkProvider, args: string[]) {
    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));
    const usdt = provider.open(JettonMinter.createFromAddress(usdtAddress.address));

    const userWallet = async (address: Address) => provider.open(
        JettonWallet.createFromAddress(
            await usdt.getWalletAddress(address)
        )
    );

    const deployJettonWallet = await userWallet(provider.sender().address!);
    const bridgeJettonWallet = await userWallet(bridge.address);
    const bridgePoolJettonWallet = await userWallet(bridgePool.address);

    console.log('deployJettonWallet', deployJettonWallet.address);
    console.log('bridgeJettonWallet', bridgeJettonWallet.address);
    console.log('bridgePoolJettonWallet', bridgePoolJettonWallet.address);

    const admin = provider.sender();

    // bridge 
    // 1. add jetton whitelist
    // await addJettonWhitelist(bridge, admin, chainIdSide)
    // await addJettonWhitelist(bridge, admin, chainIdMain);

    // let resMain = await bridge.getIsJettonSupport(chainIdMain, usdtAddress.address);
    // console.log(resMain);
    // let resSide = await bridge.getIsJettonSupport(chainIdSide, usdtAddress.address);
    // console.log(resSide);

    // 2. set bridge pool
    // await setBridgePool(bridge, admin);

    // get pool
    // let pool = await bridge.getBridgePool(usdtAddress.address);
    // console.log(pool);
    
    // 3. set target contract
    // await setTargetContract(bridge, admin);

    // let targetContractAddress = await bridge.getTargetContractAddress(chainIdMain);
    // console.log(aelf.utils.base58.encode(targetContractAddress));
    // targetContractAddress = await bridge.getTargetContractAddress(chainIdSide);
    // console.log(aelf.utils.base58.encode(targetContractAddress));
    
    // 4. create swap
    // await createSwap(bridgePool, admin);
    // // get swap info
    // let swapInfo = await bridgePool.getSwapData(chainIdSide);
    // let hex = swapInfo.swapId.toString(16);
    // if (hex.length % 2) hex = '0' + hex;
    // const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
    // let swapId = Buffer.from(bytes).toString('base64');
    // console.log(swapId);
    // console.log(swapInfo.fromChainId);
    // console.log(swapInfo.originShare);
    // console.log(swapInfo.targetShare);
    // console.log(swapInfo.swappedAmount);
    // console.log(swapInfo.swappedTimes);
    // // get swap info
    // let swapInfoMain = await bridgePool.getSwapData(chainIdMain);
    // hex = swapInfoMain.swapId.toString(16);
    // if (hex.length % 2) hex = '0' + hex;
    // let bytes1 = Uint8Array.from(Buffer.from(hex, 'hex'));
    // let swapIdSide = Buffer.from(bytes1).toString('base64');
    // console.log(swapIdSide);
    // console.log(swapInfoMain.fromChainId);
    // console.log(swapInfoMain.originShare);
    // console.log(swapInfoMain.targetShare);
    // console.log(swapInfoMain.swappedAmount);
    // console.log(swapInfoMain.swappedTimes);
    
    // 5. set jetton
    // await setJetton(bridgePool, admin, bridgePoolJettonWallet.address);

    // // get jetton
    // let jetton = await bridgePool.getJettonAddress();
    // console.log(jetton.jettonAddress);
    // console.log(jetton.poolJettonWalletAddress);
    
    // 6. set daily limit
    // await setDailyLimit(bridgePool, admin, 750000000000n, getUTCMidnight());
    // 7. set rate limit
    // await setRateLimit(bridgePool, admin, 50000000000n, 500000000n);

    // // get daily limit
    // let dailyLimit = await bridgePool.getReceiptDailyLimit(chainIdSide);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // // get rate limit
    // let rateLimit = await bridgePool.getReceiptRateLimit(chainIdSide);
    // console.log(rateLimit.tokenCapacity);
    // console.log(rateLimit.rate);
    // console.log(rateLimit.currentTokenAmount);
    // console.log(rateLimit.isEnable);
    // console.log(rateLimit.refreshTime);
    // // get daily limit
    // dailyLimit = await bridgePool.getSwapDailyLimit(chainIdSide);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // // get rate limit
    // rateLimit = await bridgePool.getSwapRateLimit(chainIdSide);
    // console.log(rateLimit.tokenCapacity);
    // console.log(rateLimit.rate);
    // console.log(rateLimit.currentTokenAmount);
    // console.log(rateLimit.isEnable);
    // console.log(rateLimit.refreshTime);

    // // get daily limit
    // let dailyLimit = await bridgePool.getReceiptDailyLimit(chainIdMain);
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
    // // get daily limit
    // dailyLimit = await bridgePool.getSwapDailyLimit(chainIdMain);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // // get rate limit
    // rateLimit = await bridgePool.getSwapRateLimit(chainIdMain);
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

    // // remove jetton liquidity
    // let amount_remove_liquidity = 100000000n;
    let fee = toNano('0.1');
    const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(admin.address!);
    let usr_liq = provider.open(BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
    // let liq = await usr_liq.getLiquidity();
    // console.log(liq);
    let amount_remove_liquidity = 100000000n;
    await usr_liq.sendRemoveLiquidity(admin, fee, amount_remove_liquidity);


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
    //         chainIdSide: chainIdSide,
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
    //         chainIdSide: chainIdSide,
    //         limitType: 1,
    //         refreshTime: refreshTime,
    //         dailyLimit: BigInt(15000000)
    //     }]);

}

async function addJettonWhitelist(bridge: OpenedContract<Bridge>, admin: Sender, chainId: number) {
    await bridge.sendAddJetton(
        admin,
        toNano('0.01'), [usdtAddress.address], chainId);
}

async function setBridgePool(bridge: OpenedContract<Bridge>, admin: Sender) {
    await bridge.sendSetBridgePool(admin, toNano('0.01'), [{
        jetton_address: usdtAddress.address,
        contract_address: bridgePoolAddress.address
    }]);
}

async function setTargetContract(bridge: OpenedContract<Bridge>, admin: Sender) {
    const sideContract = aelf.utils.base58.decode(targetContractSide);
    const mainContract = aelf.utils.base58.decode(targetContractMain);
    await bridge.sendTargetContract(admin, toNano('0.01'), [
        {
            chain_id: chainIdSide,
            bridge_address: Buffer.from(sideContract)
        },
        {
            chain_id: chainIdMain,
            bridge_address: Buffer.from(mainContract)
        }]);
}

async function createSwap(bridgePool: OpenedContract<BridgePool>, admin: Sender) {
    await bridgePool.sendCreateSwap(
        admin, toNano('0.01'), [{
            fromChainId: chainIdSide,
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

async function setDailyLimit(bridgePool: OpenedContract<BridgePool>, admin: Sender, dailyLimit: bigint, refreshTime: number) {
    await bridgePool.sendSetDailyLimit(
        admin,
        toNano('0.02'),
        [{
            chainId: 9992731,
            limitType: 0,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        }, {
            chainId: 9992731,
            limitType: 1,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        }, {
            chainId: 1866392,
            limitType: 0,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        }, {
            chainId: 1866392,
            limitType: 1,
            refreshTime: refreshTime,
            dailyLimit: dailyLimit
        }]);
}

async function setRateLimit(bridgePool: OpenedContract<BridgePool>, admin: Sender, capacity: bigint, rateLimit: bigint) {
    await bridgePool.sendSetRateLimit(
        admin,
        toNano('0.03'),
        [{
            chainId: 9992731,
            limitType: 0,
            tokenCapacity: capacity,
            rate: rateLimit,
        }, {
            chainId: 9992731,
            limitType: 1,
            tokenCapacity: capacity,
            rate: rateLimit,
        }, {
            chainId: 1866392,
            limitType: 0,
            tokenCapacity: capacity,
            rate: rateLimit,
        }, {
            chainId: 1866392,
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