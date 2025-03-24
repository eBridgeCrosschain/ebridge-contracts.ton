import {
    Blockchain,
    BlockchainSnapshot,
    BlockchainTransaction,
    SandboxContract,
    TreasuryContract,
    internal
} from '@ton/sandbox';
import {
    Address,
    beginCell,
    BitString,
    Cell,
    Dictionary,
    toNano,
    internal as internal_relaxed,
} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import '@ton/test-utils';
import {compile, sleep} from '@ton/blueprint';
import {findTransactionRequired, randomAddress} from "@ton/test-utils";
import {Buffer} from "buffer";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgePool} from "../wrappers/BridgePool";
import {BridgeReceiptAccount} from "../wrappers/BridgeReceiptAccount";
import aelf from "aelf-sdk";
import {MultiSig, MultiSigConfig, SetTargetContractRequest, UpdateRequest} from "../wrappers/MultiSign";
import {Errors, Op} from "../wrappers/constants";
import {MultiSigOrder} from "../wrappers/MultiSignOrder";
import exp from "constants";
import {MultisigOrder} from "@ton/ton";
import {executeFrom, executeTill, findTransaction, Txiterator} from "./helpers";

describe('MultiSign', () => {
    let code: Cell;
    let orderCode: Cell;
    let blockchain: Blockchain;
    let bridge: SandboxContract<Bridge>;
    let deployer: SandboxContract<TreasuryContract>;
    let proposer: SandboxContract<TreasuryContract>;
    let member1: SandboxContract<TreasuryContract>;
    let member2: SandboxContract<TreasuryContract>;
    let member3: SandboxContract<TreasuryContract>;
    let member4: SandboxContract<TreasuryContract>;
    let multiSign: SandboxContract<MultiSig>;
    let signers: Address[];
    let testMsg: SetTargetContractRequest;
    let initialState: BlockchainSnapshot;
    let curTime: () => number;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        code = await compile('MultiSign');
        orderCode = await compile('MultiSignOrder');
        deployer = await blockchain.treasury('deployer');
        proposer = await blockchain.treasury('proposer');
        member1 = await blockchain.treasury('member1');
        member2 = await blockchain.treasury('member2');
        member3 = await blockchain.treasury('member3');
        member4 = await blockchain.treasury('member4');
        signers = [deployer.address, proposer.address, member1.address, member2.address, member3.address, member4.address];
        let config = {
            threshold: 4,
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
        // deploy bridge for test
        let poolContractDicDefault = Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.Address());
        let receiptRecordDic = Dictionary.empty(Dictionary.Keys.BigUint(320), Dictionary.Values.Cell());
        let jettonWhitelistDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        let targetContractDicDefault = Dictionary.empty();
        let tempUpgrade = beginCell().endCell();
        let bridge_code = await compile('Bridge');
        bridge = blockchain.openContract(Bridge.createFromConfig({
            bridge_pool_address_dic: poolContractDicDefault,
            oracle_address: deployer.address,
            jetton_whitelist_dic: jettonWhitelistDicDefault,
            is_pause: false,
            pause_controller: deployer.address,
            admin: multiSign.address,
            owner: deployer.address,
            temp_upgrade: tempUpgrade,
            target_contract_dic: targetContractDicDefault,
            receipt_record_dic: receiptRecordDic
        }, bridge_code));
        const deployBridgeResult = await bridge.sendDeploy(deployer.getSender(), toNano('1'));
        expect(deployBridgeResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridge.address,
            deploy: true,
            success: true,
        });
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
                    dest: bridge.address,
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
        initialState = blockchain.snapshot();

        curTime = () => blockchain.now ?? Math.floor(Date.now() / 1000);

    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('bridge set target contract pipeline', async () => {
        let chainId = 1931928;
        let targetAddress = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
        const buffer = aelf.utils.base58.decode(targetAddress);
        let configs = [{
            chain_id: chainId,
            bridge_address: Buffer.from(buffer)
        }]
        const masterMsg = Bridge.packSetTargetContractBody(Op.bridge.set_target_contract, configs);
        let orderAddress = await multiSign.getOrderAddress(0n);
        let res = await multiSign.sendNewOrder(deployer.getSender(),
            {
                type: 'set_target_contract',
                sendMode: 1,
                message: {
                    info: {
                        type: 'internal',
                        ihrDisabled: false,
                        bounce: true,
                        bounced: false,
                        dest: bridge.address,
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
            },
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

        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        let orderInfo = await order.getOrderData();
        expect(orderInfo.inited).toEqual(true);
        expect(orderInfo.threshold).toEqual(4);
        console.log(orderInfo.signers);
        expect(orderInfo.order_seqno).toEqual(0n);
        expect(orderInfo.approvals_num).toEqual(0);

        let resApprove = await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 111);

        expect(resApprove.transactions).toHaveTransaction({
            from: deployer.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(1);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);

        let resApprove2 = await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 112);

        expect(resApprove2.transactions).toHaveTransaction({
            from: member2.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove2.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(2);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);
        expect(orderInfo.approvals[2]).toEqual(false);
        expect(orderInfo.approvals[3]).toEqual(true);

        let resApprove3 = await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 113);
        expect(resApprove3.transactions).toHaveTransaction({
            from: member1.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove3.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(3);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);
        expect(orderInfo.approvals[2]).toEqual(true);
        expect(orderInfo.approvals[3]).toEqual(true);
        expect(orderInfo.executed).toEqual(false);

        let resApprove4 = await order.sendApprove(member4.getSender(), 5, toNano('0.1'), 114);
        expect(resApprove4.transactions).toHaveTransaction({
            from: member4.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove4.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });
        expect(resApprove4.transactions).toHaveTransaction({
            from: multiSign.address,
            to: bridge.address,
            success: true
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(4);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);
        expect(orderInfo.approvals[2]).toEqual(true);
        expect(orderInfo.approvals[3]).toEqual(true);
        expect(orderInfo.approvals[4]).toEqual(false);
        expect(orderInfo.approvals[5]).toEqual(true);
        expect(orderInfo.executed).toEqual(true);

        let targetContract = await bridge.getTargetContractAddress(chainId);
        expect(aelf.utils.base58.encode(targetContract).toString()).toEqual(targetAddress);

    });

    it('bridge add jetton whitelist pipeline', async () => {
        let masterMsg =
            Bridge.packJettonWhitelistBody(
                Op.bridge.add_jetton_whitelist,
                [deployer.address, proposer.address],
                9992731);

        let orderAddress = await multiSign.getOrderAddress(0n);
        let res = await multiSign.sendNewOrder(deployer.getSender(),
            {
                type: 'add_jetton_whitelist',
                sendMode: 1,
                message: {
                    info: {
                        type: 'internal',
                        ihrDisabled: false,
                        bounce: true,
                        bounced: false,
                        dest: bridge.address,
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
            },
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

        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        let orderInfo = await order.getOrderData();
        expect(orderInfo.inited).toEqual(true);
        expect(orderInfo.threshold).toEqual(4);
        console.log(orderInfo.signers);
        expect(orderInfo.order_seqno).toEqual(0n);
        expect(orderInfo.approvals_num).toEqual(0);

        let resApprove = await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 111);

        expect(resApprove.transactions).toHaveTransaction({
            from: deployer.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(1);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);

        let resApprove2 = await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 112);

        expect(resApprove2.transactions).toHaveTransaction({
            from: member2.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove2.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(2);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);
        expect(orderInfo.approvals[2]).toEqual(false);
        expect(orderInfo.approvals[3]).toEqual(true);

        let resApprove3 = await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 113);
        expect(resApprove3.transactions).toHaveTransaction({
            from: member1.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove3.transactions).not.toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(3);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);
        expect(orderInfo.approvals[2]).toEqual(true);
        expect(orderInfo.approvals[3]).toEqual(true);
        expect(orderInfo.executed).toEqual(false);

        let resApprove4 = await order.sendApprove(member4.getSender(), 5, toNano('0.1'), 114);
        expect(resApprove4.transactions).toHaveTransaction({
            from: member4.address,
            to: orderAddress,
            success: true
        });
        expect(resApprove4.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });
        expect(resApprove4.transactions).toHaveTransaction({
            from: multiSign.address,
            to: bridge.address,
            success: true
        });

        orderInfo = await order.getOrderData();
        expect(orderInfo.approvals_num).toEqual(4);
        expect(orderInfo.approvals[0]).toEqual(true);
        expect(orderInfo.approvals[1]).toEqual(false);
        expect(orderInfo.approvals[2]).toEqual(true);
        expect(orderInfo.approvals[3]).toEqual(true);
        expect(orderInfo.approvals[4]).toEqual(false);
        expect(orderInfo.approvals[5]).toEqual(true);
        expect(orderInfo.executed).toEqual(true);

        let jettonWhitelist = await bridge.getIsJettonSupport(9992731, deployer.address);
        expect(jettonWhitelist).toEqual(true);

    });
    
    it('new order repeated',async () => {
        let orderAddress = await multiSign.getOrderAddress(0n);
        let res = await multiSign.sendNewOrder(deployer.getSender(),
            testMsg, curTime() + 1000);
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
        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        let resApprove = await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 111);
        expect(resApprove.transactions).toHaveTransaction({
            from: deployer.address,
            to: orderAddress,
            success: true
        });
        await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 112);
        await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 113);
        let resApprove4 = await order.sendApprove(member4.getSender(), 5, toNano('0.1'), 114);
        expect(resApprove4.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute
        });
        let orderAddress1 = await multiSign.getOrderAddress(1n);
        let res2 = await multiSign.sendNewOrder(deployer.getSender(),
            testMsg, curTime() + 1000);
        expect(res2.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            success: true
        });
        expect(res2.transactions).toHaveTransaction({
            from: multiSign.address,
            to: orderAddress1,
            deploy: true,
            success: true
        });
        let order1 = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress1));
        resApprove = await order1.sendApprove(deployer.getSender(), 0, toNano('0.1'), 111);
        expect(resApprove.transactions).toHaveTransaction({
            from: deployer.address,
            to: orderAddress1,
            success: true
        });
        await order1.sendApprove(member2.getSender(), 3, toNano('0.1'), 112);
        await order1.sendApprove(member1.getSender(), 2, toNano('0.1'), 113);
        resApprove4 = await order1.sendApprove(member4.getSender(), 5, toNano('0.1'), 114);
        expect(resApprove4.transactions).toHaveTransaction({
            from: orderAddress1,
            to: multiSign.address,
            op: Op.multisig.execute
        });
    });

    it('order expiration time should exceed current time', async () => {
        let orderAddress = await multiSign.getOrderAddress(0n);

        const res = await multiSign.sendNewOrder(deployer.getSender(),
            testMsg, curTime() - 100);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            success: false,
            aborted: true,
            exitCode: Errors.multisig.expired
        });
        expect(res.transactions).not.toHaveTransaction({
            from: multiSign.address,
            to: orderAddress
        });
    });
    it('only signers and proposers should be able to create orders', async () => {
        const nobody = await blockchain.treasury('nobody');
        let orderAddress = await multiSign.getOrderAddress(0n);
        const msgSigner = MultiSig.newOrderMessage(testMsg, curTime() + 1000,
            true, // is signer
            0, // Address index
        );
        // Make sure proposers a checked against list too
        const msgProp = MultiSig.newOrderMessage(testMsg, curTime() + 1000,
            false, // is signer
            0, // Address index
        );
        let assertUnauthorizedOrder = (txs: BlockchainTransaction[], from: Address) => {
            expect(txs).toHaveTransaction({
                from,
                to: multiSign.address,
                success: false,
                aborted: true,
                exitCode: Errors.multisig.unauthorized_new_order
            });
            expect(txs).not.toHaveTransaction({
                from: multiSign.address,
                to: orderAddress,
                deploy: true
            });
        }
        let nobodyMsgs = [msgSigner, msgProp];
        for (let nbMessage of nobodyMsgs) {
            let res = await blockchain.sendMessage(internal({
                from: nobody.address,
                to: multiSign.address,
                body: nbMessage,
                value: toNano('1')
            }));

            assertUnauthorizedOrder(res.transactions, nobody.address);
        }
    });
    it('should reject order creation with insufficient incomming value', async () => {
        const year = 3600 * 24 * 365;
        
        let   orderAddress = await multiSign.getOrderAddress(0n);
        // Twice as low as we need
        const msgValue = (await multiSign.getOrderEstimate(testMsg, BigInt(curTime() + year))) / 2n;

        const res = await multiSign.sendNewOrder(deployer.getSender(), testMsg, curTime() + year, msgValue);
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            success: false,
            aborted: true,
            exitCode: Errors.multisig.not_enough_ton
        });
        expect(res.transactions).not.toHaveTransaction({
            from: multiSign.address,
            to: orderAddress
        });
    });
    // it('expired order execution should be denied', async () => {
    //     const deployRes  = await multiSign.sendNewOrder(proposer.getSender(), testMsg, curTime() + 1);
    //     let orderAddress = await multiSign.getOrderAddress(0n);
    //     expect(deployRes.transactions).toHaveTransaction({
    //         from: multiSign.address,
    //         on: orderAddress,
    //         op: Op.order.init,
    //         deploy: true,
    //         success: true
    //     });
    //     // Some time passed after init
    //     blockchain.now++;
    //     let txIter = new Txiterator(blockchain,internal({
    //         from: deployer.address,
    //         to: orderAddress,
    //         value: toNano('1'),
    //         body: beginCell().storeUint(Op.order.approve, 32)
    //             .storeUint(0, 64)
    //             .storeUint(0, 8)
    //             .endCell()
    //     }));
    //
    //     const orderContract = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
    //
    //     let txs = await executeTill(txIter,{
    //         from: orderAddress,
    //         on: deployer.address,
    //         op: Op.order.approved,
    //         success: true,
    //     });
    //
    //     findTransactionRequired(txs, {
    //         from: deployer.address,
    //         on: orderAddress,
    //         op: Op.order.approve,
    //         success: true,
    //         outMessagesCount: 2 // Make sure both approval notification and exec message is produced
    //     });
    //     // Make sure exec transaction is not yet proccessed
    //     expect(findTransaction(txs, {
    //         from: orderAddress,
    //         on: multiSign.address,
    //         op: Op.multisig.execute
    //     })).not.toBeDefined();
    //     // While message was in transit, some more time passed
    //     blockchain.now++;
    //     // Continue execution
    //     txs = await executeFrom(txIter);
    //     // Execute message was sent, but failed due to expiery
    //     expect(txs).toHaveTransaction({
    //         from: orderAddress,
    //         on: multiSign.address,
    //         op: Op.multisig.execute,
    //         success: false,
    //         aborted: true,
    //         exitCode: Errors.order.expired
    //     });
    //     expect((await orderContract.getOrderData()).executed).toBe(true);
    // });
    it('should execute update multisig parameters correctly', async () => {
        const newSigners = await blockchain.createWallets(4);
        const updOrder : UpdateRequest = {
            type: "update",
            threshold: 4,
            signers: newSigners.map(s => s.address),
            proposers: []
        };
        let initialSeqno = (await multiSign.getMultisigData()).nextOrderSeqno;
        let res = await multiSign.sendNewOrder(deployer.getSender(), updOrder, Math.floor(Date.now() / 1000 + 1000));

        expect((await multiSign.getMultisigData()).nextOrderSeqno).toEqual(initialSeqno + 1n);
        let orderAddress = await multiSign.getOrderAddress(0n);
        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: orderAddress,
            success: true
        });
        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        res = await order.sendApprove(member3.getSender(), 4, toNano('0.1'), 3);
        
        expect(res.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute,
            success: true
        });

        const dataAfter = await multiSign.getMultisigData();
        expect(dataAfter.threshold).toEqual(BigInt(updOrder.threshold));
        expect(dataAfter.signers[0]).toEqualAddress(newSigners[0].address);
        expect(dataAfter.proposers.length).toBe(0);
    });
    it('should reject multisig parameters with inconsistently ordered signers or proposers', async () => {
        // To produce inconsistent dictionary we have to craft it manually
        const malformed = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Address());
        malformed.set(0, randomAddress());
        malformed.set(2, randomAddress());
        let updateCell = beginCell().storeUint(Op.actions.update_multisig_params, 32)
            .storeUint(4, 8)
            .storeDict(malformed) // signers
            .storeDict(null) // empty proposers
            .endCell();

        let dataBefore   = await multiSign.getMultisigData();
        let orderAddress = await multiSign.getOrderAddress(dataBefore.nextOrderSeqno);
        let res = await multiSign.sendNewOrder(deployer.getSender(), updateCell, curTime() + 100);
        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        let resApprove = await order.sendApprove(member3.getSender(), 4, toNano('0.1'), 3);
        expect(resApprove.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute,
            aborted: true,
            success: false,
            exitCode: Errors.multisig.invalid_dictionary_sequence
        });

        const stringify = (x: Address) => x.toString();
        let dataAfter = await multiSign.getMultisigData();
        // Order seqno should increase
        expect(dataAfter.nextOrderSeqno).toEqual(dataBefore.nextOrderSeqno + 1n);
        // Rest stay same
        expect(dataAfter.threshold).toEqual(dataBefore.threshold);
        expect(dataAfter.signers.map(stringify)).toEqual(dataBefore.signers.map(stringify));
        expect(dataAfter.proposers.map(stringify)).toEqual(dataBefore.proposers.map(stringify));

        dataBefore   = await multiSign.getMultisigData();
        orderAddress = await multiSign.getOrderAddress(dataBefore.nextOrderSeqno);

        // Now let's test if proposers order is checked
        malformed.clear();
        // Let's be bit sneaky. It's kinda consistent, but starts with 1. Should fail anyways.
        malformed.set(1, randomAddress());
        malformed.set(2, randomAddress());

        updateCell = beginCell().storeUint(Op.actions.update_multisig_params, 32)
            .storeUint(4, 8)
            .storeDict(null) // Empty signers? Yes, that is allowed
            .storeDict(malformed) // proposers
            .endCell();

        res = await multiSign.sendNewOrder(deployer.getSender(), updateCell, curTime() + 100);
        order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        res = await order.sendApprove(member3.getSender(), 4, toNano('0.1'), 3);
        expect(res.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute,
            aborted: true,
            success: false,
            exitCode: Errors.multisig.invalid_dictionary_sequence
        });

        dataAfter = await multiSign.getMultisigData();
        // Order seqno should increase
        expect(dataAfter.nextOrderSeqno).toEqual(dataBefore.nextOrderSeqno + 1n);
        // Rest stay same
        expect(dataAfter.threshold).toEqual(dataBefore.threshold);
        expect(dataAfter.signers.map(stringify)).toEqual(dataBefore.signers.map(stringify));
        expect(dataAfter.proposers.map(stringify)).toEqual(dataBefore.proposers.map(stringify));
    });
    it('multisig should invalidate previous orders if signers change', async () => {
        let resSet = await multiSign.sendNewOrder(deployer.getSender(), testMsg, curTime() + 1000);
        expect(resSet.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            success: true
        });
        let orderAddressBefore = await multiSign.getOrderAddress(0n);
        let order1 = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddressBefore));
        await order1.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order1.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order1.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        const newSigners = await blockchain.createWallets(4);
        const updOrder : UpdateRequest = {
            type: "update",
            threshold: 1,
            signers: newSigners.map(s => s.address),
            proposers: []
        };
        let initialSeqno = (await multiSign.getMultisigData()).nextOrderSeqno;
        let res = await multiSign.sendNewOrder(deployer.getSender(), updOrder, Math.floor(Date.now() / 1000 + 1000));

        expect((await multiSign.getMultisigData()).nextOrderSeqno).toEqual(initialSeqno + 1n);
        let orderAddress = await multiSign.getOrderAddress(1n);
        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: orderAddress,
            success: true
        });
        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        let resA = await order.sendApprove(member4.getSender(), 5, toNano('0.1'), 4);
        expect(resA.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute,
            success: true,
        });
        let resApprove = await order1.sendApprove(member4.getSender(), 5, toNano('0.1'), 5);
        
        expect(resApprove.transactions).toHaveTransaction({
            from: orderAddressBefore,
            to: multiSign.address,
            op: Op.multisig.execute,
            aborted: true,
            success: false,
            exitCode: Errors.multisig.singers_outdated
        });
    });
    it('multisig should invalidate previous orders if threshold changes', async () => {
        let resSet = await multiSign.sendNewOrder(deployer.getSender(), testMsg, curTime() + 1000);
        expect(resSet.transactions).toHaveTransaction({
            from: deployer.address,
            to: multiSign.address,
            success: true
        });
        let orderAddressBefore = await multiSign.getOrderAddress(0n);
        let order1 = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddressBefore));
        await order1.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order1.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order1.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        const newSigners = await blockchain.createWallets(6);
        const updOrder : UpdateRequest = {
            type: "update",
            threshold: 5,
            signers: newSigners.map(s => s.address),
            proposers: []
        };
        let initialSeqno = (await multiSign.getMultisigData()).nextOrderSeqno;
        let res = await multiSign.sendNewOrder(deployer.getSender(), updOrder, Math.floor(Date.now() / 1000 + 1000));

        expect((await multiSign.getMultisigData()).nextOrderSeqno).toEqual(initialSeqno + 1n);
        let orderAddress = await multiSign.getOrderAddress(1n);
        expect(res.transactions).toHaveTransaction({
            from: multiSign.address,
            to: orderAddress,
            success: true
        });
        let order = blockchain.openContract(MultiSigOrder.createFromAddress(orderAddress));
        await order.sendApprove(deployer.getSender(), 0, toNano('0.1'), 0);
        await order.sendApprove(member1.getSender(), 2, toNano('0.1'), 1);
        await order.sendApprove(member2.getSender(), 3, toNano('0.1'), 2);
        let resA = await order.sendApprove(member4.getSender(), 5, toNano('0.1'), 4);
        expect(resA.transactions).toHaveTransaction({
            from: orderAddress,
            to: multiSign.address,
            op: Op.multisig.execute,
            success: true,
        });
        let resApprove = await order1.sendApprove(member4.getSender(), 5, toNano('0.1'), 5);

        expect(resApprove.transactions).toHaveTransaction({
            from: orderAddressBefore,
            to: multiSign.address,
            op: Op.multisig.execute,
            aborted: true,
            success: false,
            exitCode: Errors.multisig.singers_outdated
        });
    });
    it('multisig should not execute orders deployed by other multisig contract', async () => {
        const coolHacker = await blockchain.treasury('1337');
        const newConfig : MultiSigConfig = {
            threshold: 1,
            signers: [coolHacker.address],
            proposers: [proposer.address],
            orderCode
        };

        const evilMultisig = blockchain.openContract(MultiSig.createFromConfig(newConfig,code));

        const legitData = await multiSign.getMultisigData();
        let res = await evilMultisig.sendDeploy(coolHacker.getSender(), toNano('10'));
        expect(res.transactions).toHaveTransaction({
            from: coolHacker.address,
            to: evilMultisig.address,
            deploy: true,
            success: true
        });
        const evilPayload: SetTargetContractRequest = {
            type: "set_target_contract",
            sendMode: 1,
            message: internal_relaxed({
                to: coolHacker.address,
                value: toNano('100000'),
                body: beginCell().storeUint(1337, 32).endCell()
            })
        };
        let orderPayload = MultiSig.packSetTargetContractRequest(evilPayload)

        const mock_signers = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Address());
        // Copy the real signers
        for (let i = 0; i < legitData.signers.length; i++) {
            mock_signers.set(i, legitData.signers[i]);
        }
        const evalOrder: SetTargetContractRequest = {
            type: "set_target_contract",
            sendMode: 1,
            message: internal_relaxed({
                to: multiSign.address,
                value: toNano('0.01'),
                body: beginCell().storeUint(Op.multisig.execute, 32)
                    .storeUint(0, 64)
                    .storeUint(legitData.nextOrderSeqno, 256)
                    .storeUint(0xffffffffffff, 48)
                    .storeUint(0xff, 8)
                    .storeUint(BigInt('0x' + beginCell().storeDictDirect(mock_signers).endCell().hash().toString('hex')), 256) // pack legit hash
                    .storeRef(orderPayload) // Finally eval payload
                    .endCell()
            })
        };

        res = await evilMultisig.sendNewOrder(coolHacker.getSender(), evalOrder, curTime() + 100);
        let order = await evilMultisig.getOrderAddress(0n);
        let orderContract = blockchain.openContract(MultiSigOrder.createFromAddress(order));
        let resApprove = await orderContract.sendApprove(coolHacker.getSender(), 0, toNano('0.1'), 0);

        expect(resApprove.transactions).toHaveTransaction({
            from: evilMultisig.address,
            to: multiSign.address,
            op: Op.multisig.execute,
            aborted: true,
            success: false, 
            exitCode: Errors.multisig.unauthorized_execute
        });
        // No funds exfiltrated
        expect(resApprove.transactions).not.toHaveTransaction({
            from: multiSign.address,
            to: coolHacker.address
        });
    });
});
