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


const bridgeAddress = Address.parseFriendly("EQDZV48b9MC5w1DQsUPTZcmKpGzt13sbMvHrWqcQqTQUVdrR");
const bridgePoolAddress = Address.parseFriendly("EQAOWkc0ArTeXP6MkgVx1-Zelk21uRq5flcjwBmw2Tjt5yey");
const nativePoolAddress = Address.parseFriendly("EQBcYW6bUy77wlQFLRBGl2aaYhFgliD_Jfcx7AUPv-ii-Ati");
const bridgeSwapAddress = Address.parseFriendly("EQB6PCFSgqSkv0308G2ZQsZPjS63375DXKQ_Bs_vBiAqSK3l");
const nativeSwapAddress = Address.parseFriendly("EQBun5DRg-z0z9SZiMp6_PaTqtcJSt6pCOTfr_O2tGeMLQuE");
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
    const bridgeSwap = provider.open(BridgeSwap.createFromAddress(bridgeSwapAddress.address));
    const nativeSwap = provider.open(BridgeSwap.createFromAddress(nativeSwapAddress.address));
    const jetton_minter = provider.open(JettonMinter.createFromAddress(jettonMinter.address));

    const userWallet = async (address: Address) => provider.open(
        JettonWallet.createFromAddress(
            await jetton_minter.getWalletAddress(address)
        )
    );

    const deployJettonWallet = await userWallet(provider.sender().address!);
    const bridgeJettonWallet = await userWallet(bridge.address);
    const bridgePoolJettonWallet = await userWallet(bridgePool.address);

    console.log('deployJettonWallet', deployJettonWallet.address);
    console.log('bridgeJettonWallet', bridgeJettonWallet.address);
    console.log('bridgePoolJettonWallet', bridgePoolJettonWallet.address);
    /*
    deployJettonWallet 
    bridgeJettonWallet EQBM3cjPDl5UlP2rn_ObJfwhICAlfY1gjUtxgRtI2ybeeNn-
    bridgePoolJettonWallet EQBj_gan8s3ZcGHZqsuJC_bdeLzXxitHMi2A3vBY5NEQjHin
     */
    const admin = provider.sender();
    
    // const mainContract = aelf.utils.base58.decode(targetContractMain);
    // await bridge.sendTargetContract(admin, toNano('0.01'), [
    //     {
    //         chain_id: chainIdMain,
    //         bridge_address: Buffer.from(mainContract)
    //     }]);
    
    
    // mock token deployer = EQDsJj94gXdTrsUGFHM-KVFT-RPUFAe4TIVS-EM7ip9cG8M5
    // let initialAccountJettonBalance = BigInt(10000000000);
    // await jetton_minter.sendMint(
    //     provider.sender(),
    //     testAccount.address,
    //     initialAccountJettonBalance,
    //     toNano('0.05'),
    //     toNano('0.1'));
    // console.log(await deployJettonWallet.getJettonBalance());

    // bridge 
    // const admin = provider.sender();
    // 1. add jetton whitelist
    // await addJettonWhitelist(bridge, admin, chainId)
    // await addJettonWhitelist(bridge, admin, chainIdMain);
    // 2. set bridge swap
    // await setBridgeSwap(bridge, admin);
    // 3. set bridge pool
    // await setBridgePool(bridge, admin);
    // // 4. set target contract
    // await setTargetContract(bridge, admin);

    // // 5. create swap
    // await createSwap(bridgeSwap, admin);

    // // 6. set bridge
    // await setBridge(bridgePool, admin, bridge.address);
    // // 6'. set bridge swap
    // await setBridgePoolSwap(bridgePool, admin, bridgeSwap.address);
    // // 7. set jetton
    // await setJetton(bridgePool, admin, jettonMinter.address, bridgePoolJettonWallet.address);
    // 8. set daily limit
    // await setDailyLimit(bridgePool, admin, toNano('1000'), chainId, getUTCMidnight());
    // 9. set rate limit
    // await setRateLimit(bridgePool, admin, toNano('1000'), toNano('100'), chainId);
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
    // // get swap info
    // let swapInfo = await bridgeSwap.getSwapData(chainId);
    // // swapId:6akJ+WNN/7uYAH2YHHjbc11djaEkxzpWPI9gK/jdDns=
    // console.log(swapInfo.swapId.toString('base64'));
    // console.log(swapInfo.fromChainId);
    // console.log(swapInfo.originShare);
    // console.log(swapInfo.targetShare);
    // console.log(swapInfo.swappedAmount);
    // console.log(swapInfo.swappedTimes);
    // // get swap info
    // let swapInfoMain = await bridgeSwap.getSwapData(chainIdMain);
    // // swapId:
    // console.log(swapInfoMain.swapId.toString('base64'));
    // console.log(swapInfoMain.fromChainId);
    // console.log(swapInfoMain.originShare);
    // console.log(swapInfoMain.targetShare);
    // console.log(swapInfoMain.swappedAmount);
    // console.log(swapInfoMain.swappedTimes);
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
    // // get daily limit
    // let dailyLimit = await bridgePool.getReceiptDailyLimit(chainId);
    // console.log(dailyLimit.dailyLimit);
    // console.log(dailyLimit.refreshTime);
    // console.log(dailyLimit.remainToken);
    // get rate limit
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
    // let forwardAmount = toNano('0.05');
    // let payload = BridgePool.packAddLiquidityBody();
    // await deployJettonWallet.sendTransfer(
    //     admin,
    //     toNano('0.1'),
    //     amount_add_liquidity,
    //     bridgePool.address,
    //     provider.sender().address!,
    //     beginCell().storeUint(0,1).endCell(),
    //     forwardAmount,
    //     payload);
    
    // // // remove jetton liquidity
    // let amount_remove_liquidity = 100000000n;
    // let fee = toNano('0.05');
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
    let refreshTime = getUTCMidnight();
    await bridgePool.sendSetDailyLimit(
        admin,
        toNano('0.02'),
        [{
            chainId: chainId,
            limitType: 1,
            refreshTime: refreshTime,
            dailyLimit: BigInt(15000000)
        }]);

}

async function addJettonWhitelist(bridge: OpenedContract<Bridge>, admin: Sender, chainId: number) {
    await bridge.sendAddJetton(
        admin,
        toNano('0.01'), [jettonMinter.address, nativeToken.address], chainId);
}

async function setBridgeSwap(bridge: OpenedContract<Bridge>, admin: Sender) {
    await bridge.sendSetBridgeSwap(admin, toNano('0.01'), [{
        jetton_address: jettonMinter.address,
        contract_address: bridgeSwapAddress.address
    },
        {
            jetton_address: nativeToken.address,
            contract_address: nativeSwapAddress.address
        }]);
}

async function setBridgePool(bridge: OpenedContract<Bridge>, admin: Sender) {
    await bridge.sendSetBridgePool(admin, toNano('0.01'), [{
        jetton_address: jettonMinter.address,
        contract_address: bridgePoolAddress.address
    },
        {
            jetton_address: nativeToken.address,
            contract_address: nativePoolAddress.address
        }]);
}

async function setTargetContract(bridge: OpenedContract<Bridge>, admin: Sender) {
    const sideContract = aelf.utils.base58.decode(targetContract);
    const mainContract = aelf.utils.base58.decode(targetContractMain);
    await bridge.sendTargetContract(admin, toNano('0.01'), [
        {
            chain_id: chainId,
            bridge_address: Buffer.from(sideContract)
        },
        {
            chain_id: chainIdMain,
            bridge_address: Buffer.from(mainContract)
        }]);
}

async function createSwap(bridgeSwap: OpenedContract<BridgeSwap>, admin: Sender) {
    await bridgeSwap.sendCreateSwap(
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

async function setJetton(bridgePool: OpenedContract<BridgePool>, admin: Sender, jettonAddress: Address, bridgePoolJettonWallet: Address) {
    await bridgePool.sendSetJetton(admin, toNano('0.01'), jettonAddress, bridgePoolJettonWallet);
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