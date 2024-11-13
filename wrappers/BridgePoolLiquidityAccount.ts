import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type BridgePoolLiquidityAccountConfig = {};

export function BridgePoolLiquidityAccountConfigToCell(config: BridgePoolLiquidityAccountConfig): Cell {
    return beginCell().endCell();
}

export class BridgePoolLiquidityAccount implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new BridgePoolLiquidityAccount(address);
    }

    static createFromConfig(config: BridgePoolLiquidityAccountConfig, code: Cell, workchain = 0) {
        const data = BridgePoolLiquidityAccountConfigToCell(config);
        const init = { code, data };
        return new BridgePoolLiquidityAccount(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}


