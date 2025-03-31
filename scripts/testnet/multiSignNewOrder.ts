import {Address, toNano, ContractProvider, beginCell} from "@ton/core";
import {compile, NetworkProvider} from "@ton/blueprint";
import aelf from "aelf-sdk";
import {Buffer} from "buffer";
import {MultiSig} from "../../wrappers/MultiSign";
import {Bridge} from "../../wrappers/Bridge";
import {Op} from "../../wrappers/constants";

const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const multiSignAddress = Address.parseFriendly("EQBlPNgBLZfD1HhZotqHjhrJVBoIbxCqV2CUvn-U5Qq4CL6P");

export async function run(provider: NetworkProvider, args: string[]) {
    let chainId = 1;
    let targetAddress = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
    const buffer = aelf.utils.base58.decode(targetAddress);
    let targetContractconfigs = [{
        chain_id: chainId,
        bridge_address: Buffer.from(buffer)
    }];
    // const multiSign = provider.open(MultiSig.createFromAddress(multiSignAddress.address));
    let code = await compile('MultiSign');
    let orderCode = await compile('MultiSignOrder');
    const proposer = Address.parseFriendly("0QA8VgxvokmwT7Mc49D8SZQIdn1y3hffeZCXUptZMGR8qNC5");
    const member1 = Address.parseFriendly("0QCFH3Qccem9wAH0W5zqsRRuHXGv5S7aPt87l_4a3fLn7OzK");
    const member2 = Address.parseFriendly("0QDpDohrUHMFCdOG8lUXkcM53oM5izolPKCq-S7W-ReNLeLE");
    const member3 = Address.parseFriendly("0QBugMoruW7eM0tsP90ZoJTII8-gfaDHX8-jwBVXAW_ogg6R");
    const member4 = Address.parseFriendly("0QAPgLg9eRDcqUyiAaZmTCcrfyol9LjTUdzR5Beie6y6DAZH");
    let signers = [proposer.address, member1.address, member2.address, member3.address, member4.address];
    const timestampUTCSeconds = Math.floor(Date.now() / 1000);
    const oneDayLaterSeconds = timestampUTCSeconds + 24 * 60 * 60;
    let config = {
        threshold: 1,
        signers,
        proposers: [proposer.address],
        orderCode
    };
    const multiSign = provider.open(MultiSig.createFromConfig(config, code));
    
    const masterMsg = Bridge.packSetTargetContractBody(Op.bridge.set_target_contract, targetContractconfigs);
    //
    await multiSign.sendNewOrder(provider.sender(), {
        type: 'set_target_contract',
        sendMode: 1,
        message: {
            info: {
                type: 'internal',
                ihrDisabled: false,
                bounce: true,
                bounced: false,
                dest: bridgeAddress.address,
                value: {
                    coins: toNano('0.1') // ton amount
                },
                ihrFee: 0n,
                forwardFee: 0n,
                createdLt: 0n,
                createdAt: 0
            },
            body: masterMsg
        }
    }, oneDayLaterSeconds, toNano('0.1'), 0, true);
    // let newOracle = "EQChOx2UsaWRVb8k9NAARNKaNqHVC-uQ98Ff3Uy-qDgqBtMg";
    // const changeOracleMessage = Bridge.packSetOracleBody(Address.parseFriendly(newOracle).address);
    // await multiSign.sendNewOrder(provider.sender(), {
    //     type: 'change_oracle_address',
    //     sendMode: 1,
    //     message: {
    //         info: {
    //             type: 'internal',
    //             ihrDisabled: false,
    //             bounce: true,
    //             bounced: false,
    //             dest: bridgeAddress.address,
    //             value: {
    //                 coins: toNano('0.01') // ton amount
    //             },
    //             ihrFee: 0n,
    //             forwardFee: 0n,
    //             createdLt: 0n,
    //             createdAt: 0
    //         },
    //         body: changeOracleMessage
    //     }
    // }, oneDayLaterSeconds, toNano('0.02'), 0, true);
    let seq = await multiSign.getMultisigData();
    console.log(seq.nextOrderSeqno);
    // console.log(await multiSign.getOrderAddress(1n));
}