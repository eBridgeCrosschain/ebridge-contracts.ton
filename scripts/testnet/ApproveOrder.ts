import {Address, toNano, ContractProvider, beginCell} from "@ton/core";
import {compile, NetworkProvider} from "@ton/blueprint";
import {MultiSigOrder} from "../../wrappers/MultiSignOrder";

const bridgeAddress = Address.parseFriendly("kQDS511tzowt2x1xyIDgpglhaz6wG9uVP2t4BixFTViYQoM_");
const multiSignAddress = Address.parseFriendly("EQBlPNgBLZfD1HhZotqHjhrJVBoIbxCqV2CUvn-U5Qq4CL6P");
const orderAddress = Address.parseFriendly("kQCrdUTl3gDppir3gvOxRVX4P3tAEZ_9rTr-1DO5FW6Bwx42");
export async function run(provider: NetworkProvider, args: string[]) {
    const order = provider.open(MultiSigOrder.createFromAddress(orderAddress.address));
    await order.sendApprove(provider.sender(),0,toNano('0.01'),111);
}