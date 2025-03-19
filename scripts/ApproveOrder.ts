import {Address, toNano, ContractProvider, beginCell} from "@ton/core";
import {compile, NetworkProvider} from "@ton/blueprint";
import aelf from "aelf-sdk";
import {Buffer} from "buffer";
import {Bridge} from "../wrappers/Bridge";
import {Op} from "../wrappers/constants";
import {MultiSig} from "../wrappers/MultiSign";
import {MultiSigOrder} from "../wrappers/MultiSignOrder";

const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const multiSignAddress = Address.parseFriendly("EQBlPNgBLZfD1HhZotqHjhrJVBoIbxCqV2CUvn-U5Qq4CL6P");
const orderAddress = Address.parseFriendly("kQCvwDfxBNBVa1LNwjRuFrXUSbb5DiRoo8aaboYSDUn3axU_");
export async function run(provider: NetworkProvider, args: string[]) {
    
    const order = provider.open(MultiSigOrder.createFromAddress(orderAddress.address));
    await order.sendApprove(provider.sender(),0,toNano('0.1'),111);
}