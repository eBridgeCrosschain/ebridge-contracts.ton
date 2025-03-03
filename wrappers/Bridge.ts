import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode
} from '@ton/core';
import {Op} from "./constants";
import {BitString} from "@ton/core/dist/boc/BitString";
import {Buffer} from "buffer";

export type BridgeConfig = {
    bridge_pool_address_dic: Dictionary<any, any>,
    jetton_whitelist_dic: Dictionary<any, any>,
    oracle_address: Address,
    is_pause: boolean,
    pause_controller: Address,
    admin: Address,
    owner: Address,
    temp_upgrade: Cell,
    target_contract_dic: Dictionary<any, any>,
    receipt_record_dic: Dictionary<any, any>,
};

export type JettonContractConfig = {
    jetton_address: Address,
    contract_address: Address,
}
export type TargetContractConfig = {
    chain_id: number,
    bridge_address: Buffer,
}

export function BridgeConfigToCell(config: BridgeConfig): Cell {
    return beginCell()
        .storeRef(beginCell()
            .storeDict(config.bridge_pool_address_dic)
            .storeDict(config.jetton_whitelist_dic)
            .storeDict(config.receipt_record_dic)
            .endCell())
        .storeBit(config.is_pause)
        .storeRef(beginCell()
            .storeRef(beginCell()
                .storeAddress(config.admin)
                .storeAddress(config.owner)
                .storeDict(config.target_contract_dic)
                .endCell())
            .storeRef(beginCell()
                .storeAddress(config.pause_controller)
                .storeAddress(config.oracle_address)
                .endCell())
            .endCell()
        )
        .storeRef(config.temp_upgrade)
        .endCell();
}

export class Bridge implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {
    }

    static createFromAddress(address: Address) {
        return new Bridge(address);
    }

    static createFromConfig(config: BridgeConfig, code: Cell, workchain = 0) {
        const data = BridgeConfigToCell(config);
        const init = {code, data};
        return new Bridge(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    static getQueryId() {
        return Math.round(Math.random() * (2000 - 1000) + 1000);
    }

    // pack body
    static packJettonWhitelistBody(op: number, addresses: Address[], targetChainId: number): Cell {
        let queryId = Bridge.getQueryId();
        const root = beginCell()
            .storeUint(op, 32) // op
            .storeUint(queryId, 64) // query_id;
            .storeUint(targetChainId, 32)
            .storeAddress(addresses[0]);

        let cell: Cell | null = null;

        for (let i = addresses.length - 1; i >= 1; i--) {
            const newCell = beginCell().storeAddress(addresses[i]);

            if (cell) {
                newCell.storeRef(cell);
            }

            cell = newCell.endCell();
        }

        if (cell) {
            root.storeRef(cell);
        }

        return root.endCell();
    }

    static packSetOracleBody(oracle: Address): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.change_oracle_address, 32)
            .storeUint(queryId, 64)
            .storeAddress(oracle)
            .endCell();
    }

    static packSetPoolOrSwapBody(op: number, config: JettonContractConfig[]): Cell {
        let queryId = Bridge.getQueryId();
        const root = beginCell()
            .storeUint(op, 32) // op
            .storeUint(queryId, 64) // query_id;
            .storeAddress(config[0].jetton_address)
            .storeAddress(config[0].contract_address);

        let cell: Cell | null = null;

        for (let i = config.length - 1; i >= 1; i--) {
            const newCell = beginCell().storeAddress(config[i].jetton_address).storeAddress(config[i].contract_address);

            if (cell) {
                newCell.storeRef(cell);
            }

            cell = newCell.endCell();
        }

        if (cell) {
            root.storeRef(cell);
        }

        return root.endCell();
    }

    static packSetTargetContractBody(op: number, config: TargetContractConfig[]): Cell {
        console.log(config[0].bridge_address.length);
        let queryId = Bridge.getQueryId();
        const root = beginCell()
            .storeUint(op, 32) // op
            .storeUint(queryId, 64) // query_id;
            .storeUint(config[0].chain_id, 32)
            .storeBuffer(config[0].bridge_address, 32);

        let cell: Cell | null = null;

        for (let i = config.length - 1; i >= 1; i--) {
            const newCell = beginCell().storeUint(config[i].chain_id, 32).storeBuffer(config[i].bridge_address, 32);

            if (cell) {
                newCell.storeRef(cell);
            }

            cell = newCell.endCell();
        }

        if (cell) {
            root.storeRef(cell);
        }

        return root.endCell();
    }

    static packChangePauseControllerBody(controller: Address): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.change_pause_controller, 32)
            .storeUint(queryId, 64)
            .storeAddress(controller)
            .endCell();
    }

    static packPauseOrRestartBody(op: number): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(op, 32)
            .storeUint(queryId, 64)
            .endCell();
    }

    static PackCreateReceiptBody(targetChainId: number, tokenWalletAddress: Address, targetAddress: Buffer, jettonAddress: Address) {
        let payload = beginCell()
            .storeUint(Op.bridge.create_receipt, 32)
            .storeUint(targetChainId, 32)
            .storeBuffer(targetAddress, 32)
            .storeAddress(jettonAddress)
            .endCell();
        return payload;
    }

    static PackFakeCreateReceiptBody(targetChainId: number, tokenWalletAddress: Address, targetAddress: Buffer, jettonAddress: Address) {
        let payload = beginCell()
            .storeUint(Op.bridge.set_bridge_pool, 32)
            .storeUint(targetChainId, 32)
            .storeBuffer(targetAddress, 32)
            .storeAddress(jettonAddress)
            .endCell();
        return payload;
    }

    static PackCreateNativeReceiptBody(targetChainId: number, targetAddress: Buffer, amount: number | bigint) {
        let queryId = Bridge.getQueryId();
        let payload = beginCell()
            .storeUint(Op.bridge.create_native_receipt, 32)
            .storeUint(queryId, 64)
            .storeUint(targetChainId, 32)
            .storeBuffer(targetAddress, 32)
            .storeCoins(amount)
            .endCell();
        return payload;
    }

    static packReceiptOk(targetChainId: number, owner: Address, jetton: Address, targetAddress: Buffer, amount: number | bigint, receiptId: Cell): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.receipt_ok, 32)
            .storeUint(queryId, 64)
            .storeUint(targetChainId, 32)
            .storeRef(beginCell()
                .storeAddress(owner)
                .storeAddress(jetton)
                .storeBuffer(targetAddress, 32)
                .endCell())
            .storeCoins(amount)
            .storeRef(receiptId)
            .endCell();
    }

    static packInitCodeUpgradeBody(code: Cell): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.init_code_upgrade, 32)
            .storeUint(queryId, 64)
            .storeRef(code)
            .endCell();
    }

    static packFinalizeUpgradeBody(): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.finalize_upgrades, 32)
            .storeUint(queryId, 64)
            .endCell();
    }

    static packCancelUpgradeBody(): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.cancel_code_upgrade, 32)
            .storeUint(queryId, 64)
            .endCell();
    }

    static packTransmit(messageId: bigint, sourceChainId: number, targetChainId: number, sender: Buffer, receiver: Address, data: Buffer, dataOther: Buffer, swapId: Cell, jetton: Address): Cell {
        let originToken = Buffer.from("USDT");
        let message = beginCell()
            .storeUint(768, 16)
            .storeBuffer(data, 96)
            .storeUint(1, 8)
            .storeRef(beginCell()
                .storeUint(608, 16)
                .storeBuffer(dataOther, 76)
                .storeUint(0, 8)
                .endCell())
            .endCell()
        let convertInfo = beginCell()
            .storeRef(swapId)
            .storeUint(targetChainId, 32)
            .storeRef(beginCell()
                .storeAddress(receiver)
                .endCell())
            .storeRef(beginCell()
                .storeAddress(jetton)
                .endCell())
            .storeRef(beginCell()
                .storeUint(1, 1)
                .endCell())
            .endCell();
        return beginCell()
            .storeUint(Op.bridge.transmit, 32)
            .storeUint(messageId, 128)
            .storeRef(beginCell()
                .storeUint(sourceChainId, 32)
                .storeUint(targetChainId, 32)
                .storeRef(beginCell()
                    .storeBuffer(sender, 32)
                    .endCell())
                .storeRef(beginCell()
                    .storeAddress(receiver)
                    .endCell())
                .storeRef(message)
                .storeRef(convertInfo)
            )
            .endCell()
    }
    
    static PackSetReceiptAccountBody(receiptAccountCode: Cell): Cell {
        let queryId = Bridge.getQueryId();
        return beginCell()
            .storeUint(Op.bridge.set_bridge_receipt_account_code, 32)
            .storeUint(queryId, 64)
            .storeRef(receiptAccountCode)
            .endCell();
    }
    
    async sendSetReceiptAccount(provider: ContractProvider, via: Sender, value: bigint, receiptAccountCode: Cell) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.PackSetReceiptAccountBody(receiptAccountCode)
        });
    }

    // send
    async sendAddJetton(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jettons: Address[],
        targetChainId: number
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packJettonWhitelistBody(Op.bridge.add_jetton_whitelist, jettons, targetChainId)
        });
    }

    async sendRemoveJetton(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        addresses: Address[],
        targetChainId: number,
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packJettonWhitelistBody(Op.bridge.remove_jetton, addresses, targetChainId)
        });
    }

    async sendSetOracleAddress(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        oracle: Address) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packSetOracleBody(oracle)
        });
    }

    async sendSetBridgePool(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        configs: JettonContractConfig[],
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packSetPoolOrSwapBody(Op.bridge.set_bridge_pool, configs)
        });
    }

    async sendSetBridgeSwap(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        configs: JettonContractConfig[],
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packSetPoolOrSwapBody(Op.bridge.set_bridge_swap, configs)
        });
    }

    async sendTargetContract(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        configs: TargetContractConfig[],
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packSetTargetContractBody(Op.bridge.set_target_contract, configs)
        });
    }

    async sendChangePauseController(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        pause_controller: Address,
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packChangePauseControllerBody(pause_controller)
        });
    }


    async sendPause(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packPauseOrRestartBody(Op.bridge.pause)
        });
    }

    async sendRestart(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packPauseOrRestartBody(Op.bridge.restart)
        });
    }

    async sendGetterBridgeSwap(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jetton:Address
    ) {
        let queryId = Bridge.getQueryId();
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.bridge.getter_bridge_swap_address, 32)
                .storeUint(queryId, 64)
                .storeAddress(jetton)
                .endCell()
        });
    }

    async sendReceiptOk(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        targetChainId: number,
        owner: Address,
        jetton: Address,
        targetAddress: Buffer,
        amount: number | bigint,
        receiptId: Cell
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packReceiptOk(targetChainId, owner, jetton, targetAddress, amount, receiptId)
        });
    }

    async sendInitCodeUpgrade(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        code: Cell
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packInitCodeUpgradeBody(code)
        });
    }
    
    async sendCancelUpgrade(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ){
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packCancelUpgradeBody()
        });
    }

    async sendFinalizeUpgradeCode(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packFinalizeUpgradeBody()
        });
    }

    async sendTransmit(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        messageId: bigint,
        sourceChainId: number,
        targetChainId: number,
        sender: Buffer,
        receiver: Address,
        data: Buffer,
        dataOther: Buffer,
        swapId: Cell,
        jetton: Address
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.packTransmit(messageId, sourceChainId, targetChainId, sender, receiver, data, dataOther, swapId, jetton)
        });

    }
    
    async sendRecordReceiptHash(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        timestamp: number,
        hash:bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(1, 32)
                .storeUint(timestamp, 64)
                .storeUint(hash,256)
                .endCell()
        });
    }

    async sendCleanReceiptHash(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        timestamp: number,
        hash:bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(2, 32)
                .storeUint(timestamp, 64)
                .storeUint(hash,256)
                .endCell()
        });
    }

    async sendCleanReceiptHash1(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(1, 32)
                .endCell()
        });
    }

    async sendCreateNativeReceipt(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        targetChainId: number,
        targetAddress: Buffer,
        amount: number | bigint
    ) {
        await provider.internal(via, {
            value: value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Bridge.PackCreateNativeReceiptBody(targetChainId, targetAddress,amount)
        });
    }

    // get

    async getIsJettonSupport(provider: ContractProvider, targetChainId: number, address: Address) {
        const result = await provider.get('get_is_jetton_support', [{
            type: 'int',
            value: BigInt(targetChainId)
        }, {
            type: 'slice',
            cell: beginCell().storeAddress(address).endCell()
        }]);
        return result.stack.readBoolean();
    }

    async getBridgePool(provider: ContractProvider, address: Address) {
        const result = await provider.get('get_bridge_pool_address', [{
            type: 'slice',
            cell: beginCell().storeAddress(address).endCell()

        }]);
        return result.stack.readAddress();
    }

    async getBridgeSwap(provider: ContractProvider, address: Address) {
        const result = await provider.get('get_bridge_swap_address', [{
            type: 'slice',
            cell: beginCell().storeAddress(address).endCell()
        }]);
        return result.stack.readAddress();
    }

    async getUpdate(provider: ContractProvider) {
        const result = await provider.get('get_upgrade_status', []);
        return result.stack.readCell();
    }

    async getOwner(provider: ContractProvider) {
        const result = await provider.get('get_owner', []);
        return result.stack.readAddress();
    }

    async getAdmin(provider: ContractProvider) {
        const result = await provider.get('get_admin', []);
        return result.stack.readAddress();
    }

    async getPauseController(provider: ContractProvider) {
        const result = await provider.get('get_pause_controller', []);
        return result.stack.readAddress();
    }

    async getOracleAddress(provider: ContractProvider) {
        const result = await provider.get('get_oracle_address', []);
        return result.stack.readAddress();
    }

    async getTargetContractAddress(provider: ContractProvider, chainId: number) {
        const result = await provider.get('get_target_contract_address', [{
            type: 'int',
            value: BigInt(chainId)
        }]);
        return result.stack.readBuffer();
    }

    async getPaused(provider: ContractProvider) {
        const result = await provider.get('is_bridge_paused', []);
        return result.stack.readBoolean();
    }

    async getReceiptAddress(provider: ContractProvider, address: Address) {
        const result = await provider.get('get_bridge_receipt_address', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(address).endCell()
            }
        ]);
        return result.stack.readAddress();
    }

    async getEstimateCreateReceiptFee(provider: ContractProvider) {
        const result = await provider.get('get_estimate_create_receipt_fee', []);
        return result.stack.readBigNumber()
    }

    async getEstimateLockFwdFee(provider: ContractProvider) {
        const res = await provider.get('get_estimate_lock_fwd_fee', []);
        return res.stack.readBigNumber();
    }

    async getEstimateSwapFee(provider: ContractProvider) {
        const res = await provider.get('get_estimate_swap_fee', []);
        return res.stack.readBigNumber();
    }

    async getEstimateCreateNativeFee(provider: ContractProvider) {
        const res = await provider.get('get_estimate_create_native_fee', []);
        return res.stack.readBigNumber();
    }
    async getEstimateReleaseTransferFee(provider: ContractProvider) {
        const res = await provider.get('get_estimate_release_transfer_fee', []);
        return res.stack.readBigNumber();
    }
    
    //get_estimate_transfer_lock_fwd_fee_split
    async getEstimateTransferLockFwdFeeSplit(provider: ContractProvider) {
        const {stack}  = await provider.get('get_estimate_transfer_lock_fwd_fee_split', []);
        return {
            totalFee:stack.readBigNumber(),
            gasFee:stack.readBigNumber(),
            fwdFee:stack.readBigNumber()
        }
    }
    
    async get_receipt_hash_exist(provider: ContractProvider, hash: bigint,timestamp: number) {
        const result = await provider.get('is_receipt_hash_exist', [{
            type: 'int',
            value: BigInt(hash)
        },{
            type: 'int',
            value: BigInt(timestamp)
        }]);
        return result.stack.readBoolean();
    }
    
    async get_receipt_hash(provider: ContractProvider, timestamp: number) {
        const {stack}  = await provider.get('get_receipt_hash', [{
            type: 'int',
            value: BigInt(timestamp)
        }]);
        return {
            found:stack.readBoolean(),
            dic:stack.readCellOpt()
        }
    }
    
    async get_receipt_hash_two_days_ago(provider: ContractProvider) {
        const {stack}  = await provider.get('get_receipt_hash_two_days_ago', []);
        return {
            found:stack.readBoolean(),
            dic:stack.readCellOpt()
        }
    }
    
    async get_message_id_receipt_dic(provider: ContractProvider) {
        const res = await provider.get('get_message_id_receipt_dic', []);
        return res.stack.readCellOpt();
    }
    
    async get_liquidity_account_fee(provider: ContractProvider) {
        const res = await provider.get('get_liquidity_account_fee', []);
        return res.stack.readBigNumber();
    }
}


