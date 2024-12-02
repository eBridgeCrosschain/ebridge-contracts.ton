import {Address, beginCell, Cell, Dictionary, toNano} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import {compile, NetworkProvider} from '@ton/blueprint';
import {BridgeSwap} from "../wrappers/BridgeSwap";

export async function run(provider: NetworkProvider) {
    console.log(provider.sender().address);
    const bridgeAddress = Address.parseFriendly("EQDZV48b9MC5w1DQsUPTZcmKpGzt13sbMvHrWqcQqTQUVdrR");
    const bridgePoolAddress = Address.parseFriendly("EQAOWkc0ArTeXP6MkgVx1-Zelk21uRq5flcjwBmw2Tjt5yey");
    const nativePoolAddress = Address.parseFriendly("EQBcYW6bUy77wlQFLRBGl2aaYhFgliD_Jfcx7AUPv-ii-Ati");
    const jettonAddress = Address.parseFriendly("EQBSKUt9k20Gz8RqG71xloqnzcFHt0MdWg1UnWcyU5Xf9CsU");
    const nativeToken = Address.parseFriendly("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
    let tempUpgrade = beginCell()
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeAddress(null)
        .storeRef(beginCell().endCell())
        .storeAddress(null)
        .endCell();
    let dic = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    const bridgeSwap = provider.open(BridgeSwap.createFromConfig({
        bridgePoolAddress: nativePoolAddress.address,
        jettonAddress: nativeToken.address,
        bridgeAddress: bridgeAddress.address,
        admin: provider.sender().address!,
        owner: provider.sender().address!,
        tempUpgrade: tempUpgrade,
        swapDic: dic,
        receiptDic: dic
    }, await compile('BridgeSwap')));

    await bridgeSwap.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(bridgeSwap.address);

    // run methods on `ebridgeContractsTon`

}
