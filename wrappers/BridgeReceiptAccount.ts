import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type BridgeReceiptAccountConfig = {};

export function BridgeReceiptAccountConfigToCell(config: BridgeReceiptAccountConfig): Cell {
    return beginCell().endCell();
}

export class BridgeReceiptAccount implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new BridgeReceiptAccount(address);
    }

    static createFromConfig(config: BridgeReceiptAccountConfig, code: Cell, workchain = 0) {
        const data = BridgeReceiptAccountConfigToCell(config);
        const init = { code, data };
        return new BridgeReceiptAccount(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}


