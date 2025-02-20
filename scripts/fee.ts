import {Address} from "@ton/core";
import {NetworkProvider} from "@ton/blueprint";
import {Bridge} from "../wrappers/Bridge";
import {BridgePool} from "../wrappers/BridgePool";
import {JettonMinter} from "../wrappers/JettonMinter";

const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const bridgePoolAddress = Address.parseFriendly("kQCOgvqpldcUabiUJdgtHffTy9_-IfvIoZ9Rk26D8q5uVDf9");
const nativePoolAddress = Address.parseFriendly("kQCPfgNN-077aNCCUlKm59ZbDDbwdRfiuOyofEr41sw1KTEC");
const jettonMinter = Address.parseFriendly("EQBSKUt9k20Gz8RqG71xloqnzcFHt0MdWg1UnWcyU5Xf9CsU");
const testAccount = Address.parseFriendly("0QA0lOMwJ1Unpc3cOLvqHaz7WYYht9MPceAFz4qhpk89Sxek");
const nativeToken = Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

export async function run(provider: NetworkProvider, args: string[]) {
    const bridge = provider.open(Bridge.createFromAddress(bridgeAddress.address));
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));
    const nativePool = provider.open(BridgePool.createFromAddress(nativePoolAddress.address));
    
    console.log("Start to get create receipt fee");
    let createReceiptFee = await bridge.getEstimateCreateReceiptFee();
    console.log(`Create receipt fee: ${createReceiptFee}`);
    
    console.log("Start to get lock fwd fee");
    let lockFwdFee = await bridge.getEstimateLockFwdFee();
    console.log(`Lock fwd fee: ${lockFwdFee}`);
    
    console.log("Start to get swap fee");
    let swapFee = await bridge.getEstimateSwapFee();
    console.log(`Swap fee: ${swapFee}`);
    
    console.log("Start to get create native receipt fee");
    let createNativeReceiptFee = await bridge.getEstimateCreateNativeFee();
    console.log(`Create native receipt fee: ${createNativeReceiptFee}`);
    
    console.log("Start to get release transfer fee");
    let releaseTransferFee = await bridge.getEstimateReleaseTransferFee();
    console.log(`Release transfer fee: ${releaseTransferFee}`);
    
    console.log("Start to get release transfer fwd fee");
    let releaseTransferFwdFee = await bridgePool.getTransferFee();
    console.log(`Release transfer fwd fee: ${releaseTransferFwdFee}`);
    
    console.log("Start to get add liquidity fee");
    let addLiquidityFee = await bridgePool.getAddLiquidityFee();
    console.log(`Add liquidity fee: ${addLiquidityFee}`);
    
    console.log("Start to get remove liquidity fee");
    let removeLiquidityFee = await bridgePool.getRemoveLiquidityFee();
    console.log(`Remove liquidity fee: ${removeLiquidityFee}`);
    
    console.log("Start to get add native token liquidity fee");
    let addNativeLiquidityFee = await bridgePool.getAddNativeLiquidityFee();
    console.log(`Add native token liquidity fee: ${addNativeLiquidityFee}`);
    
    console.log("Start to get remove native token liquidity fee");
    let removeNativeLiquidityFee = await bridgePool.getRemoveNativeLiquidityFee();
    console.log(`Remove native token liquidity fee: ${removeNativeLiquidityFee}`);
    
}