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
const usdtAddress = Address.parseFriendly("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");

export async function run(provider: NetworkProvider, args: string[]) {
    const bridgePool = provider.open(BridgePool.createFromAddress(bridgePoolAddress.address));

    let amount_remove_liquidity = 100000000n;
    const liquidity_account = await bridgePool.getPoolLiquidityAccountAddress(provider.sender().address!);
    console.log(liquidity_account);
    let user_liq = provider.open(
        BridgePoolLiquidityAccount.createFromAddress(liquidity_account));
    await user_liq.sendRemoveLiquidity(
        provider.sender(),
        toNano('0.1'),
        amount_remove_liquidity,
        true
    );
    // let liquidityAfter = await bridgePool.getPoolLiquidity();
    // console.log(liquidityAfter);
}