import {Address, beginCell, Cell, Dictionary, toNano} from '@ton/core';
import {Bridge} from '../../wrappers/Bridge';
import {compile, NetworkProvider} from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log(provider.sender().address);
    const oracle_address = "EQA7xEMU7IVqNxmUPYqIgfh4BnzCeiWnQ3IP7TGu6lmmzCZ5";
    let poolContractDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Address());
    let receiptRecordDic = Dictionary.empty(Dictionary.Keys.BigInt(16), Dictionary.Values.Cell());
    let jettonWhitelistDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    let targetContractDicDefault = Dictionary.empty();
    let tempUpgrade = beginCell()
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeAddress(null)
        .storeRef(beginCell().endCell())
        .storeAddress(null)
        .endCell();

    const bridge = provider.open(Bridge.createFromConfig({
        bridge_pool_address_dic: poolContractDicDefault,
        oracle_address: Address.parseFriendly(oracle_address).address,
        jetton_whitelist_dic: jettonWhitelistDicDefault,
        is_pause: false,
        pause_controller: provider.sender().address!,
        admin: provider.sender().address!,
        owner: provider.sender().address!,
        temp_upgrade: tempUpgrade,
        target_contract_dic: targetContractDicDefault,
        receipt_record_dic: receiptRecordDic
    }, await compile('Bridge')));

    await bridge.sendDeploy(provider.sender(), toNano('10'));

    await provider.waitForDeploy(bridge.address);

}
