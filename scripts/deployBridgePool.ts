import {Address, beginCell, Cell, Dictionary, toNano} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import {compile, NetworkProvider} from '@ton/blueprint';
import {BridgePool} from "../wrappers/BridgePool";

export async function run(provider: NetworkProvider) {
    console.log(provider.sender().address);
    const bridgeAddress = Address.parseFriendly("EQDZV48b9MC5w1DQsUPTZcmKpGzt13sbMvHrWqcQqTQUVdrR");
    const jettonAddress = Address.parseFriendly("EQBSKUt9k20Gz8RqG71xloqnzcFHt0MdWg1UnWcyU5Xf9CsU");
    const nativeToken = Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
    let dic = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    let tempUpgrade = beginCell()
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeAddress(null)
        .storeRef(beginCell().endCell())
        .storeAddress(null)
        .endCell();
    let bridgeReceiptAccountCode = await compile('BridgeReceiptAccount');
    let receipt_dic = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Cell());
    let receiptRecordDic = Dictionary.empty(Dictionary.Keys.BigInt(16), Dictionary.Values.Cell());
    const bridgePool = provider.open(BridgePool.createFromConfig({
        bridge_address: bridgeAddress.address,
        jetton_address: jettonAddress.address,
        daily_limit: dic,
        rate_limit: dic,
        pool_liquidity_account_code: await compile("BridgePoolLiquidityAccount"),
        admin: provider.sender().address!,
        owner: provider.sender().address!,
        temp_upgrade: tempUpgrade,
        swap_dict: dic,
        receipt_dict: receipt_dic,
        receipt_owner_dict: receiptRecordDic
    }, await compile('BridgePool')));

    await bridgePool.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(bridgePool.address);

    // run methods on `ebridgeContractsTon`

}
