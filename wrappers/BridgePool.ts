import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type BridgePoolConfig = {};

export function BridgePoolConfigToCell(config: BridgePoolConfig): Cell {
    return beginCell().endCell();
}

export class BridgePool implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new BridgePool(address);
    }

    static createFromConfig(config: BridgePoolConfig, code: Cell, workchain = 0) {
        const data = BridgePoolConfigToCell(config);
        const init = { code, data };
        return new BridgePool(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}


