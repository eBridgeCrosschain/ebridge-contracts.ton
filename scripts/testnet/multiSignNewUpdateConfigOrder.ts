import {Address, toNano, ContractProvider, beginCell} from "@ton/core";
import {compile, NetworkProvider} from "@ton/blueprint";
import aelf from "aelf-sdk";
import {Buffer} from "buffer";
import {MultiSig, UpdateRequest} from "../../wrappers/MultiSign";

const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const multiSignAddress = Address.parseFriendly("EQBlPNgBLZfD1HhZotqHjhrJVBoIbxCqV2CUvn-U5Qq4CL6P");

export async function run(provider: NetworkProvider, args: string[]) {
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
    const timestampUTCSeconds = Math.floor(Date.now() / 1000);
    const oneDayLaterSeconds = timestampUTCSeconds + 24 * 60 * 60;
    const multiSign = provider.open(MultiSig.createFromConfig(config, code));
    let newAdd = Address.parseFriendly("0QB7uF9to6Hc6pV3QTIo9QG6Ewvh_NbFvE0FH9lrjvG0e8lo");
    let newProposers = [proposer.address, newAdd.address];
    let newSigners = [proposer.address, newAdd.address, member1.address, member2.address, member3.address, member4.address];
    const updateOrder : UpdateRequest = {
        type: "update",
        threshold: 1,
        signers: newSigners,
        proposers: newProposers
    };
    // await multiSign.sendNewOrder(provider.sender(), updateOrder, oneDayLaterSeconds, toNano('0.1'),0, true);
    let seq = await multiSign.getMultisigData();
    console.log(seq);
    // console.log(await multiSign.getOrderAddress(1n));
}