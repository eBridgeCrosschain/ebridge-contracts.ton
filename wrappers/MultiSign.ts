import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary, internal, MessageRelaxed,
    Sender,
    SendMode, storeMessageRelaxed, toNano
} from '@ton/core';
import {Op} from "./constants";
import {MultiSigOrder} from "./MultiSignOrder";

export type MultiSigConfig = {
    threshold: number;
    signers: Array<Address>;
    proposers: Array<Address>;
    orderCode: Cell;
};
export type UpdateRequest = {
    type: 'update',
    threshold: number,
    signers: Array<Address>,
    proposers: Array<Address>
};
export type TransferRequest = { type: 'transfer', sendMode: SendMode, message: MessageRelaxed };

export type SetTargetContractRequest = {
    type: 'set_target_contract', sendMode: SendMode, message: MessageRelaxed
}
export type AddJettonWhitelistRequest = {
    type: 'add_jetton_whitelist', sendMode: SendMode, message: MessageRelaxed
}
export type Action = AddJettonWhitelistRequest | SetTargetContractRequest | UpdateRequest;

function arrayToCell(arr: Array<Address>): Dictionary<number, Address> {
    let dict = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Address());
    for (let i = 0; i < arr.length; i++) {
        dict.set(i, arr[i]);
    }
    return dict;
}

function cellToArray(addrDict: Cell | null): Array<Address> {
    let resArr: Array<Address> = [];
    if (addrDict !== null) {
        const dict = Dictionary.loadDirect(Dictionary.Keys.Uint(8), Dictionary.Values.Address(), addrDict);
        resArr = dict.values();
    }
    return resArr;
}

export function MultiSigConfigToCell(config: MultiSigConfig): Cell {
    return beginCell()
        .storeUint(0, 256)
        .storeRef(beginCell().storeDictDirect(arrayToCell(config.signers)))
        .storeDict(arrayToCell(config.proposers))
        .storeUint(config.threshold, 8)
        .storeUint(config.signers.length, 8)
        .storeRef(config.orderCode)
        .endCell();
}

export class MultiSig implements Contract {
    public orderSeqno: number;

    constructor(readonly address: Address,
                readonly init?: { code: Cell; data: Cell },
                readonly configuration?: MultiSigConfig) {
        this.orderSeqno = 0;
    }

    static createFromAddress(address: Address) {
        return new MultiSig(address);
    }

    static createFromConfig(config: MultiSigConfig, code: Cell, workchain = 0) {
        const data = MultiSigConfigToCell(config);
        const init = {code, data};
        return new MultiSig(contractAddress(workchain, init), init, config);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
    

    static packSetTargetContractRequest(setTargetContract: SetTargetContractRequest) {
        let message = beginCell().store(storeMessageRelaxed(setTargetContract.message)).endCell();
        return beginCell().storeUint(Op.actions.send_message, 32)
            .storeUint(setTargetContract.sendMode, 8)
            .storeRef(message)
            .endCell();
    }
    
    static packAddJettonWhitelistRequest(addJettonWhitelist: AddJettonWhitelistRequest) {
        let message = beginCell().store(storeMessageRelaxed(addJettonWhitelist.message)).endCell();
        return beginCell().storeUint(Op.actions.send_message, 32)
            .storeUint(addJettonWhitelist.sendMode, 8)
            .storeRef(message)
            .endCell();
    }

    static packUpdateRequest(update: UpdateRequest) {
        return beginCell().storeUint(Op.actions.update_multisig_params, 32)
            .storeUint(update.threshold, 8)
            .storeRef(beginCell().storeDictDirect(arrayToCell(update.signers)))
            .storeDict(arrayToCell(update.proposers))
            .endCell();
    }

    static packOrder(action: Action) {
        let actionCell = new Cell();
        if (action.type === "add_jetton_whitelist") {
            actionCell = MultiSig.packAddJettonWhitelistRequest(action)
        } else if (action.type === "set_target_contract") {
            actionCell = MultiSig.packSetTargetContractRequest(action)
        } else if (action.type === "update") {
            actionCell = MultiSig.packUpdateRequest(action)
        }
        return actionCell;
    }

    static newOrderMessage(action: Action | Cell,
                           expirationDate: number,
                           isSigner: boolean,
                           addrIdx: number,
                           query_id: number | bigint = 0) {

        const msgBody = beginCell()
            .storeUint(Op.multisig.new_order, 32)
            .storeUint(query_id, 64)
            .storeBit(isSigner)
            .storeUint(addrIdx, 8)
            .storeUint(expirationDate, 48);
        if(action instanceof Cell) {
            return msgBody.storeRef(action).endCell();
        }
        let order_cell = MultiSig.packOrder(action);
        return msgBody.storeRef(order_cell).endCell();
    }

    async sendNewOrder(provider: ContractProvider, via: Sender,
                       actions: Action | Cell,
                       expirationDate: number, value: bigint = toNano('1'), addrIdx?: number, isSigner?: boolean) {
        if (this.configuration === undefined) {
            throw new Error("Configuration is not set: use createFromConfig or loadConfiguration");
        }
        // check that via.address is in signers
        // We can only check in advance when address is known. Otherwise we have to trust isSigner flag
        if (via.address !== undefined) {
            const addrCmp = (x: Address) => x.equals(via.address!);
            addrIdx = this.configuration.signers.findIndex(addrCmp);
            if (addrIdx >= 0) {
                isSigner = true;
            } else {
                addrIdx = this.configuration.proposers.findIndex(addrCmp);
                if (addrIdx < 0) {
                    throw new Error("Sender is not a signer or proposer");
                }
                isSigner = false;
            }
        } else if (isSigner === undefined || addrIdx == undefined) {
            throw new Error("If sender address is not known, addrIdx and isSigner parameres required");
        }

        let newActions: Cell;
        if (actions instanceof Cell) {
            newActions = actions;
        } else {
            newActions = MultiSig.packOrder(actions);
        }
        console.log(newActions);
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            value,
            body: MultiSig.newOrderMessage(newActions, expirationDate, isSigner, addrIdx)
        });
    }

    async getOrderAddress(provider: ContractProvider, orderSeqno: bigint) {
        const {stack} = await provider.get("get_order_address", [{type: "int", value: orderSeqno},]);
        return stack.readAddress();
    }

    async getOrderEstimate(provider: ContractProvider, order: Action, expiration_date: bigint) {
        const orderCell = MultiSig.packOrder(order);
        const {stack} = await provider.get('get_order_estimate', [{type: "cell", cell: orderCell}, {
            type: "int",
            value: expiration_date
        }]);
        return stack.readBigNumber();
    }

    async getMultisigData(provider: ContractProvider) {
        const {stack} = await provider.get("get_multisig_data", []);
        const nextOrderSeqno = stack.readBigNumber();
        const threshold = stack.readBigNumber();
        const signers = cellToArray(stack.readCellOpt());
        const proposers = cellToArray(stack.readCellOpt());
        return {nextOrderSeqno, threshold, signers, proposers};
    }
}


