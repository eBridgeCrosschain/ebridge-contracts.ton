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
    const admin = provider.sender();

    // add jetton liquidity
    let amount_add_liquidity = 100000000n;
    let forwardAmount = toNano('0.1');
    let payload = BridgePool.packAddLiquidityBody();
    await deployJettonWallet.sendTransfer(
        admin,
        toNano('0.15'),
        amount_add_liquidity,
        bridgePool.address,
        provider.sender().address!,
        beginCell().storeUint(0, 1).endCell(),
        forwardAmount,
        payload);

    // const liquidity_account = await bridgePool.getPoolLiquidityAccountAddress(provider.sender().address!);
    // console.log(liquidity_account);
    // let liquidityAfter = await bridgePool.getPoolLiquidity();
    // console.log(liquidityAfter);
}