import {Address, beginCell, Cell, Dictionary, toNano} from '@ton/core';
import { Bridge } from '../wrappers/Bridge';
import { compile, NetworkProvider } from '@ton/blueprint';
import {JettonMinter} from "../wrappers/JettonMinter";

export async function run(provider: NetworkProvider) {
    console.log(provider.sender().address);
    // let poolContractDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256),Dictionary.Values.Address());
    // let swapContractDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256),Dictionary.Values.Address());
    // let jettonWhitelistDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256),Dictionary.Values.Cell());
    // let targetContractDicDefault = Dictionary.empty();
    // let tempUpgrade = beginCell().endCell();
    // let bridgeReceiptAccountCode = await compile('BridgeReceiptAccount');
    //
    // const bridge = provider.open(Bridge.createFromConfig({
    //     bridge_swap_address_dic: swapContractDicDefault,
    //     bridge_pool_address_dic: poolContractDicDefault,
    //     jetton_whitelist_dic: jettonWhitelistDicDefault,
    //     oracle_address: Address.parseFriendly('kQDSzWJAOueTOonbr4R_16sMqRGHMTXaGBQmxO7Wanoe-EBG').address,
    //     is_pause: false,
    //     pause_controller: provider.sender().address!,
    //     admin: provider.sender().address!,
    //     owner: provider.sender().address!,
    //     temp_upgrade: tempUpgrade,
    //     bridge_receipt_account_code: bridgeReceiptAccountCode,
    //     target_contract_dic: targetContractDicDefault
    // }, await compile('Bridge')));

    const jwallet_code = await compile('JettonWallet');
    const defaultContent = beginCell().endCell();
    const jettonMinter = provider.open(
        await JettonMinter.createFromConfig(
            {
                admin: provider.sender().address!,
                content: defaultContent,
                wallet_code: jwallet_code,
            },
            await compile('JettonMinter')));

    await jettonMinter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(jettonMinter.address);

    // run methods on `ebridgeContractsTon`

    // await bridge.getOracleAddress();
}
