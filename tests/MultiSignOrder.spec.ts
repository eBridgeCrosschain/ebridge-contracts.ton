import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, toNano, internal as internal_relaxed} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import '@ton/test-utils';
import {compile, sleep} from '@ton/blueprint';
import {randomAddress} from "@ton/test-utils";
import {Buffer} from "buffer";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgePool} from "../wrappers/BridgePool";
import {BridgeReceiptAccount} from "../wrappers/BridgeReceiptAccount";
import aelf from "aelf-sdk";
import {MultiSig} from "../wrappers/MultiSign";
import {Op} from "../wrappers/constants";

describe('MultiSignOrder', () => {
    let code: Cell;
    let orderCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let proposer: SandboxContract<TreasuryContract>;
    let multiSign: SandboxContract<MultiSig>;
    let signers: Address[];
    let initialState: BlockchainSnapshot;
    let curTime: () => number;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        code = await compile('MultiSign');
        orderCode = await compile('MultiSignOrder');
        deployer = await blockchain.treasury('deployer');
        proposer = await blockchain.treasury('proposer');
        signers = [deployer, ...await blockchain.createWallets(4)].map(s => s.address);
        let config = {
            threshold: 1,
            signers,
            proposers: [proposer.address],
            orderCode
        };

        multiSign = blockchain.openContract(MultiSig.createFromConfig(config, code));
        const deployResult = await multiSign.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            deploy: true,
            success: true,
        });
        initialState = blockchain.snapshot();

        curTime = () => blockchain.now ?? Math.floor(Date.now() / 1000);

    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('new order', async () => {
        let chainId = 1931928;
        let targetAddress = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
        const buffer = aelf.utils.base58.decode(targetAddress);
        let configs = [{
            chain_id: chainId,
            bridge_address: Buffer.from(buffer)
        }]
        let orderAddress = await multiSign.getOrderAddress(0n);
        let res = await multiSign.sendNewOrder(deployer.getSender(),
            Bridge.packSetTargetContractBody(Op.bridge.set_target_contract, configs),
            curTime() + 1000);

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            success: true
        });
        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: orderAddress,
            deploy: true,
            success: true
        });
        expect(res.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });
    });
});
