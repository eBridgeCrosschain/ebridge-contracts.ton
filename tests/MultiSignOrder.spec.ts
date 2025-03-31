import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, toNano, internal as internal_relaxed} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import '@ton/test-utils';
import {compile, sleep} from '@ton/blueprint';
import {findTransactionRequired, randomAddress} from "@ton/test-utils";
import {Buffer} from "buffer";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgePool} from "../wrappers/BridgePool";
import aelf from "aelf-sdk";
import {Action, MultiSig} from "../wrappers/MultiSign";
import {Errors, Op} from "../wrappers/constants";
import {MultiSigOrder} from "../wrappers/MultiSignOrder";
import {getRandomInt} from "./helpers";

describe('MultiSignOrder', () => {
    let code: Cell;
    let orderCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let proposer: SandboxContract<TreasuryContract>;
    let multiSign: SandboxContract<TreasuryContract>;
    let orderContract: SandboxContract<MultiSigOrder>;
    let signers: Address[];
    let signerContracts:Array<SandboxContract<TreasuryContract>>;
    let initialState: BlockchainSnapshot;
    let curTime: () => number;
    let member1: SandboxContract<TreasuryContract>;
    let member2: SandboxContract<TreasuryContract>;
    let member3: SandboxContract<TreasuryContract>;
    let member4: SandboxContract<TreasuryContract>;
    let testMsg: Action;
    let mockOrder: Cell;
    let threshold: number;
    let getContractData : (addr: Address) => Promise<Cell>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        code = await compile('MultiSign');
        orderCode = await compile('MultiSignOrder');
        deployer = await blockchain.treasury('deployer');
        proposer = await blockchain.treasury('proposer');

        multiSign = await blockchain.treasury('multisig');
        orderContract = blockchain.openContract(MultiSigOrder.createFromConfig({
            multisig: multiSign.address,
            orderSeqno: 0
        }, orderCode));

        curTime = () => blockchain.now ?? Math.floor(Date.now() / 1000);

        threshold = 4
        deployer = await blockchain.treasury('deployer');
        proposer = await blockchain.treasury('proposer');
        member1 = await blockchain.treasury('member1');
        member2 = await blockchain.treasury('member2');
        member3 = await blockchain.treasury('member3');
        member4 = await blockchain.treasury('member4');
        signerContracts = [deployer, proposer, member1, member2, member3, member4];
        signers = [deployer.address, proposer.address, member1.address, member2.address, member3.address, member4.address];
        const expDate = curTime() + 1000;
        let chainId = 1931928;
        let targetAddress = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
        const buffer = aelf.utils.base58.decode(targetAddress);
        let configs = [{
            chain_id: chainId,
            bridge_address: Buffer.from(buffer)
        }]
        const masterMsg = Bridge.packSetTargetContractBody(Op.bridge.set_target_contract, configs);
        testMsg = {
            type: 'set_target_contract',
            sendMode: 1,
            message: {
                info: {
                    type: 'internal',
                    ihrDisabled: false,
                    bounce: true,
                    bounced: false,
                    dest: member1.address,
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
        };
        mockOrder = MultiSig.packOrder(testMsg);

        const res = await orderContract.sendDeploy(multiSign.getSender(), toNano('1'), signers, expDate, mockOrder, threshold);
        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: orderContract.address,
            deploy: true,
            success: true,
        });

        getContractData = async (address: Address) => {
            const smc = await blockchain.getContract(address);
            if(!smc.account.account)
                throw("Account not found")
            if(smc.account.account.storage.state.type != "active" )
                throw("Atempting to get data on inactive account");
            if(!smc.account.account.storage.state.state.data)
                throw("Data is not present");
            return smc.account.account.storage.state.state.data
        }
        
        initialState = blockchain.snapshot();


    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('should only accept init message from multisig', async () => {
        const newOrder = blockchain.openContract(MultiSigOrder.createFromConfig({
            multisig: multiSign.address,
            orderSeqno: 1 // Next
        }, orderCode));

        const expDate = curTime() + 1000;

        const testSender = await blockchain.treasury('totally_not_multisig');
        let res = await newOrder.sendDeploy(testSender.getSender(), toNano('1'), signers, expDate, mockOrder, threshold);

        expect(res.transactions).toHaveTransaction({
            from: testSender.address,
            to: newOrder.address,
            success: false,
            aborted: true,
            exitCode: Errors.order.unauthorized_init
        });

        // Now retry with legit multisig should succeed
        const dataBefore = await newOrder.getOrderData();
        expect(dataBefore.inited).toBe(false);
        expect(dataBefore.threshold).toBe(null);

        res = await newOrder.sendDeploy(multiSign.getSender(), toNano('1'), signers, expDate, mockOrder, threshold);

        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: newOrder.address,
            success: true,
        });

        const dataAfter = await newOrder.getOrderData();
        expect(dataAfter.inited).toBe(true);
        expect(dataAfter.threshold).toEqual(threshold);
    });
    it('should reject already expired init message', async () => {
        const newOrder = blockchain.openContract(MultiSigOrder.createFromConfig({
            multisig: multiSign.address,
            orderSeqno: 1 // Next
        }, orderCode));

        const expDate = curTime() - 1;

        let res = await newOrder.sendDeploy(multiSign.getSender(), toNano('1'), signers, expDate, mockOrder, threshold);

        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            on: newOrder.address,
            op: Op.order.init,
            success: false,
            aborted: true,
            deploy: true,
            exitCode: Errors.order.expired
        });

        // Now retry with legit multisig should succeed
        const dataBefore = await newOrder.getOrderData();
        expect(dataBefore.inited).toBe(false);
        expect(dataBefore.threshold).toBe(null);

        res = await newOrder.sendDeploy(multiSign.getSender(), toNano('1'), signers, curTime() + 1000, mockOrder, threshold);

        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: newOrder.address,
            success: true,
        });

        const dataAfter = await newOrder.getOrderData();
        expect(dataAfter.inited).toBe(true);
        expect(dataAfter.threshold).toEqual(threshold);

    });
    it('should accept approval only from signers', async () => {
        let signerIdx  = getRandomInt(0, signers.length - 1);
        const rndSigner  = signerContracts[signerIdx];
        const notSigner  = randomAddress();
        const msgVal     = toNano('0.1');
        // Query id match is important in that case
        const rndQueryId = BigInt(getRandomInt(1000, 2000));

        let dataBefore = await getContractData(orderContract.address);

        // Testing not valid signer address, but valid signer index
        let res = await orderContract.sendApprove(blockchain.sender(notSigner), signerIdx, msgVal, rndQueryId);
        expect(res.transactions).toHaveTransaction({
            on: orderContract.address,
            from: notSigner,
            op: Op.order.approve,
            success: false,
            aborted: true,
            exitCode: Errors.order.unauthorized_sign
        });
        // Now let's pick valid signer address but index from another valid signer

        signerIdx = (signerIdx + 1) % signers.length;

        res = await orderContract.sendApprove(rndSigner.getSender(), signerIdx, msgVal, rndQueryId);

        expect(res.transactions).toHaveTransaction({
            on: orderContract.address,
            from: rndSigner.address,
            op: Op.order.approve,
            success: false,
            aborted: true,
            exitCode: Errors.order.unauthorized_sign
        });

        expect(await getContractData(orderContract.address)).toEqualCell(dataBefore);

        // Just to be extra sure let's pick totally invalid index
        res = await orderContract.sendApprove(rndSigner.getSender(), signers.length + 100, msgVal, rndQueryId);
        expect(res.transactions).toHaveTransaction({
            on: orderContract.address,
            from: rndSigner.address,
            op: Op.order.approve,
            success: false,
            aborted: true,
            exitCode: Errors.order.unauthorized_sign
        });
        expect(await getContractData(orderContract.address)).toEqualCell(dataBefore);
    });
    it('should reject approval if already approved', async () => {
        let dataBefore = await orderContract.getOrderData();
        let resSuccess = await orderContract.sendApprove(signerContracts[0].getSender(), 0, toNano('0.1'), 0);
        expect(resSuccess.transactions).toHaveTransaction({
            on: orderContract.address,
            from: signerContracts[0].address,
            op: Op.order.approve,
            success: true,
        });
        let dataAfter  = await orderContract.getOrderData();

        expect(dataAfter.inited).toBe(true);
        expect(dataAfter.approvals_num).toEqual(dataBefore.approvals_num! + 1);
        expect(dataAfter._approvals).toBeGreaterThan(dataBefore._approvals!);
        expect(dataAfter.approvals[0]).toBe(true);
        
        let res = await orderContract.sendApprove(signerContracts[0].getSender(), 0, toNano('0.1'), 0);
        let approvedData = findTransactionRequired(res.transactions, {
            on: orderContract.address,
            from: signerContracts[0].address,
            op: Op.order.approve,
            success: true
        });
        let outMessage = approvedData?.outMessages.get(0)?.body;
        if (outMessage != undefined) {
            let c = outMessage.asSlice();
            let op = c.loadUint(32);
            let queryId = c.loadUint(64);
            let exitCode = c.loadUint(32);
            expect(op).toBe(Op.order.approve_rejected);
            expect(exitCode).toBe(Errors.order.already_approved);
        }
    });
    it('should reject execution when executed once', async () => {
        let res = await orderContract.sendApprove(signerContracts[0].getSender(), 0, toNano('0.1'), 0);
        expect(res.transactions).toHaveTransaction({
            on: orderContract.address,
            from: signerContracts[0].address,
            op: Op.order.approve,
            success: true,
        });
        let res1 = await orderContract.sendApprove(signerContracts[1].getSender(),1, toNano('0.1'), 1);
        expect(res1.transactions).toHaveTransaction({
            on: orderContract.address,
            from: signerContracts[1].address,
            op: Op.order.approve,
            success: true,
        });
        res = await orderContract.sendApprove(signerContracts[2].getSender(), 2, toNano('0.1'), 2);
        expect(res.transactions).toHaveTransaction({
            on: orderContract.address,
            from: signerContracts[2].address,
            op: Op.order.approve,
            success: true,
        });
        res = await orderContract.sendApprove(signerContracts[3].getSender(), 3, toNano('0.1'), 3);
        expect(res.transactions).toHaveTransaction({
            on: orderContract.address,
            from: signerContracts[3].address,
            op: Op.order.approve,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            on: multiSign.address,
            from: orderContract.address,
            op: Op.multisig.execute,
            success: true,
        });

        res = await orderContract.sendApprove(signerContracts[4].getSender(), 4, toNano('0.1'), 3);
        let approvedData = findTransactionRequired(res.transactions, {
            on: orderContract.address,
            from: signerContracts[4].address,
            op: Op.order.approve,
            success: true
        });
        let outMessage = approvedData?.outMessages.get(0)?.body;
        if (outMessage != undefined) {
            let c = outMessage.asSlice();
            let op = c.loadUint(32);
            let queryId = c.loadUint(64);
            let exitCode = c.loadUint(32);
            expect(op).toBe(Op.order.approve_rejected);
            expect(exitCode).toBe(Errors.order.already_executed);
        }
        expect(res.transactions).not.toHaveTransaction({
            on: multiSign.address,
            from: orderContract.address,
            op: Op.multisig.execute,
            success: true,
        });
    });
});
