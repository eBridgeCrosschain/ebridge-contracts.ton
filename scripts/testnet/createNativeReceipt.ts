import {NetworkProvider} from "@ton/blueprint";
import {Address, beginCell, Cell, toNano} from '@ton/core';
import aelf from "aelf-sdk";
import {Bridge} from "../../wrappers/Bridge";
import {BridgePool} from "../../wrappers/BridgePool";
import {BridgePoolLiquidityAccount} from "../../wrappers/BridgePoolLiquidityAccount";
export async function run(provider: NetworkProvider, args: string[]) {

    const address = "kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_";
    const nativePoolAddress = Address.parseFriendly("kQCPfgNN-077aNCCUlKm59ZbDDbwdRfiuOyofEr41sw1KTEC");
    
    const bridge = provider.open(Bridge.createFromAddress(Address.parseFriendly(address).address));
    const nativePool = provider.open(BridgePool.createFromAddress(nativePoolAddress.address));
    

   
    let receipt_amount = toNano('0.0001');
    const chainId = 1931928;
    let targetAddress = "";
    let targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
    console.log(targetAddressBuffer.toString('hex'));
    
    // await bridge.sendCreateNativeReceipt( provider.sender(), toNano('0.50001'), chainId, targetAddressBuffer, receipt_amount);

    // await nativePool.sendAddNativeLiquidity(provider.sender(), toNano('0.15'), toNano('0.05'));

    const userLiquidityAddress = await nativePool.getPoolLiquidityAccountAddress(provider.sender().address!);
    let user_liq = provider.open(
        BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
    await user_liq.sendRemoveLiquidity(
        provider.sender(),
        toNano('0.1'),
        toNano('0.01'),
        true
    );
}
