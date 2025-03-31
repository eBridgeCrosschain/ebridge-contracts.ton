import {Address, beginCell, Cell, Dictionary, toNano} from '@ton/core';
import {compile, NetworkProvider} from '@ton/blueprint';
import {MultiSig} from "../../wrappers/MultiSign";

export async function run(provider: NetworkProvider) {
    console.log(provider.sender().address);
    let code = await compile('MultiSign');
    let orderCode = await compile('MultiSignOrder');
    const proposer = Address.parseFriendly("0QA8VgxvokmwT7Mc49D8SZQIdn1y3hffeZCXUptZMGR8qNC5");
    const member1 = Address.parseFriendly("0QCFH3Qccem9wAH0W5zqsRRuHXGv5S7aPt87l_4a3fLn7OzK");
    const member2 = Address.parseFriendly("0QDpDohrUHMFCdOG8lUXkcM53oM5izolPKCq-S7W-ReNLeLE");
    const member3 = Address.parseFriendly("0QBugMoruW7eM0tsP90ZoJTII8-gfaDHX8-jwBVXAW_ogg6R");
    const member4 = Address.parseFriendly("0QAPgLg9eRDcqUyiAaZmTCcrfyol9LjTUdzR5Beie6y6DAZH");
    let signers = [proposer.address, member1.address, member2.address, member3.address, member4.address];
    let config = {
        threshold: 1,
        signers,
        proposers: [proposer.address],
        orderCode
    };

    const multiSign = provider.open(MultiSig.createFromConfig(config, code));
    
    await multiSign.sendDeploy(provider.sender(), toNano('1'));

    await provider.waitForDeploy(multiSign.address);

}
