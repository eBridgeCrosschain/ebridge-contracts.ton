import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
    toNano
} from '@ton/core';
import {Op} from "./constants";

export type MultiSigOrderConfig = {
    multisig: Address,
    orderSeqno: number
};

function arrayToCell(arr: Array<Address>): Dictionary<number, Address> {
    let dict = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Address());
    for (let i = 0; i < arr.length; i++) {
        dict.set(i, arr[i]);
    }
    return dict;
}

function cellToArray(addrDict: Cell | null) : Array<Address>  {
    let resArr: Array<Address> = [];
    if(addrDict !== null) {
        const dict = Dictionary.loadDirect(Dictionary.Keys.Uint(8), Dictionary.Values.Address(), addrDict);
        resArr = dict.values();
    }
    return resArr;
}

export function MultiSigOrderConfigToCell(config: MultiSigOrderConfig): Cell {
    return beginCell()
        .storeAddress(config.multisig)
        .storeUint(config.orderSeqno, 256)
        .endCell();
}

export class MultiSigOrder implements Contract {
    constructor(readonly address: Address,
                readonly init?: { code: Cell, data: Cell },
                readonly configuration?: MultiSigOrderConfig) {}

    static createFromAddress(address: Address) {
        return new MultiSigOrder(address);
    }

    static createFromConfig(config: MultiSigOrderConfig, code: Cell, workchain = 0) {
        const data = MultiSigOrderConfigToCell(config);
        const init = { code, data };

        return new MultiSigOrder(contractAddress(workchain, init), init, config);
    }

    static initMessage (signers: Array<Address>,
                        expiration_date: number,
                        order: Cell,
                        threshold: number = 1,
                        signer_idx: number = 0,
                        query_id : number | bigint = 0)   {

        const msgBody = beginCell()
            .storeUint(Op.order.init, 32)
            .storeUint(query_id, 64)
            .storeUint(threshold, 8)
            .storeRef(beginCell().storeDictDirect(arrayToCell(signers)))
            .storeUint(expiration_date, 48)
            .storeRef(order);

        return msgBody.endCell();
    }
    async sendDeploy(provider: ContractProvider,
                     via: Sender,
                     value: bigint,
                     signers: Array<Address>,
                     expiration_date: number,
                     order: Cell,
                     threshold: number = 1,
                     signer_idx: number = 0,
                     query_id : number | bigint = 0) {


        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: MultiSigOrder.initMessage(signers, expiration_date, order, threshold, signer_idx, query_id)
        });
    }

    async sendApprove(provider: ContractProvider, via: Sender, signer_idx: number, value: bigint = toNano('0.1'), query_id: number | bigint = 0) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.order.approve, 32)
                .storeUint(query_id, 64)
                .storeUint(signer_idx, 8)
                .endCell()
        });
    }


    async getOrderData(provider: ContractProvider) {
        /*
        (slice multisig, int order_seqno, int threshold,
                      int sent_for_execution?, cell signers,
                      int approvals, int approvals_num, int expiration_date,
                      cell order)
        */
        const { stack } = await provider.get("get_order_data", []);
        const multisig = stack.readAddress();
        const order_seqno = stack.readBigNumber();
        const threshold = stack.readNumberOpt();
        const signers = cellToArray(stack.readCellOpt());
        const approvals = stack.readBigNumberOpt();
        const approvals_num = stack.readNumberOpt();
        const expiration_date = stack.readBigNumberOpt();
        const order = stack.readCellOpt();
        const executed = stack.readBooleanOpt();
        let approvalsArray: Array<boolean>;
        if(approvals !== null) {
            approvalsArray = Array(256);
            for(let i = 0; i < 256; i++) {
                approvalsArray[i] = Boolean((1n << BigInt(i)) & approvals);
            }
        }
        else {
            approvalsArray = [];
        }
        return {
            inited: threshold !== null, multisig, order_seqno, threshold, executed, signers,
            approvals: approvalsArray, approvals_num: approvals_num, _approvals : approvals, expiration_date, order
        };
    }
}


