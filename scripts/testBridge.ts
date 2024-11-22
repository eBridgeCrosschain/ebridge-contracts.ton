import {compile, NetworkProvider} from "@ton/blueprint";
import {Bridge} from "../wrappers/Bridge";
import {Address, toNano} from '@ton/core';
import {randomAddress} from "@ton/test-utils";
import bs58 from "bs58";
import {Buffer} from "buffer";
import aelf from "aelf-sdk";

export async function run(provider: NetworkProvider, args: string[]) {

    const address = "EQAOADR4NzUEVdZRLrq_Qg2G5mrXRZkX_NXLm_uW9W4Nqok4";
    const bridge = provider.open(Bridge.createFromAddress(Address.parseFriendly(address).address));
    // const oracle_address = "EQBCOuvczf29HIGNxrJdsmTKIabHQ1j4dW2ojlYkcru3IOYy";
    // await bridge.sendSetOracleAddress(provider.sender(), toNano('0.05'), Address.parseFriendly(oracle_address).address);
    // const oracle = await bridge.getOracleAddress();
    // console.log(oracle);
    const jetton_address = Address.parseFriendly("EQD2YshOlwLKD62kAUwPZaV4W01FpRCQzevjQjmn9Ie107XG");
    const bridge_swap_address = randomAddress();
    const bridge_pool_address = randomAddress();
    console.log(jetton_address);
    const chainId = 9992731;
    // await bridge.sendAddJetton(provider.sender(),toNano('0.005'),[jetton_address.address],chainId);
    // await bridge.sendSetBridgeSwap(provider.sender(), toNano('0.005'), [{
    //     jetton_address: jetton_address.address,
    //     contract_address: bridge_swap_address
    // }]);
    // await bridge.sendSetBridgePool(
    //     provider.sender(), toNano('0.005'),
    //     [{
    //         jetton_address: jetton_address.address,
    //         contract_address: bridge_pool_address
    //     }]);
    //
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
    // let code = await compile('Bridge');
    // await bridge.sendInitCodeUpgrade(
    //     provider.sender(),
    //     toNano('0.03'),
    //     code
    // );
    
    await bridge.sendFinalizeUpgradeCode(provider.sender(), toNano('0.01'));
    
    // let res = await bridge.getUpdate();
    // let a = res.asSlice();
    // let end_code = a.loadUint(64);
    // console.log(end_code);
}
