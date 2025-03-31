import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, toNano} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import '@ton/test-utils';
import {compile, sleep} from '@ton/blueprint';
import {findTransactionRequired, randomAddress} from "@ton/test-utils";
import {Buffer} from "buffer";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import aelf from "aelf-sdk";
import {Op} from "../wrappers/constants";
import {createHash} from 'crypto';
import {BridgePool} from "../wrappers/BridgePool";
import exp from "constants";

describe('Bridge', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bridge: SandboxContract<Bridge>;
    // jetton
    let jwallet_code: Cell;
    let minter_code: Cell;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let userWallet: any;
    let defaultContent: Cell;
    let testJettonAddress: Address;
    let testJettonAddress1: Address;
    let testJettonAddress2: Address;

    let poolAddress: SandboxContract<TreasuryContract>;
    let poolSideAddress: SandboxContract<TreasuryContract>;
    let pauseController: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let testAccount: SandboxContract<TreasuryContract>
    let owner: SandboxContract<TreasuryContract>;
    let oracle: SandboxContract<TreasuryContract>;
    let tempUpgrade: Cell;
    let targetContractDic: Dictionary<any, any>;
    let initialState: BlockchainSnapshot;
    let curTime: () => number;
    const chainId = 9992731;
    const chainIdSide = 6662731;

    beforeAll(async () => {
        code = await compile('Bridge');
        jwallet_code = await compile('JettonWallet');
        minter_code = await compile('JettonMinter');
        blockchain = await Blockchain.create();
        pauseController = await blockchain.treasury('pause');
        testJettonAddress1 = randomAddress();
        testJettonAddress = randomAddress();
        testJettonAddress2 = randomAddress();
        oracle = await blockchain.treasury('oracle');
        poolAddress = await blockchain.treasury('BridgePool');
        admin = await blockchain.treasury('admin');
        owner = await blockchain.treasury('owner');
        tempUpgrade = beginCell()
            .storeUint(0, 64)
            .storeUint(0, 64)
            .storeUint(0, 64)
            .storeAddress(null)
            .storeRef(beginCell().endCell())
            .storeAddress(null)
            .endCell();
        deployer = await blockchain.treasury('deployer');
        testAccount = await blockchain.treasury('testAccount');

        // jetton
        defaultContent = beginCell().endCell();
        jettonMinter = blockchain.openContract(
            await JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: defaultContent,
                    wallet_code: jwallet_code,
                },
                minter_code));
        userWallet = async (address: Address) => blockchain.openContract(
            JettonWallet.createFromAddress(
                await jettonMinter.getWalletAddress(address)
            )
        );

        const deployMockJettonMinter = await jettonMinter.sendDeploy(deployer.getSender(), toNano('1'));

        expect(deployMockJettonMinter.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
        });

        let poolContractDicDefault = Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.Address());
        let receiptRecordDic = Dictionary.empty(Dictionary.Keys.BigUint(320), Dictionary.Values.Cell());
        let jettonWhitelistDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        let targetContractDicDefault = Dictionary.empty();
        bridge = blockchain.openContract(Bridge.createFromConfig({
            bridge_pool_address_dic: poolContractDicDefault,
            oracle_address: oracle.address,
            jetton_whitelist_dic: jettonWhitelistDicDefault,
            is_pause: false,
            pause_controller: pauseController.address,
            admin: admin.address,
            owner: owner.address,
            temp_upgrade: tempUpgrade,
            target_contract_dic: targetContractDicDefault,
            receipt_record_dic: receiptRecordDic
        }, code));


        const deployResult = await bridge.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridge.address,
            deploy: true,
            success: true,
        });

        const deployerJettonWallet = await userWallet(deployer.address);
        const accountJettonWallet = await userWallet(testAccount.address);
        const bridgeJettonWallet = await userWallet(bridge.address);

        // first mint some jettons to test account
        let initialTotalSupply = await jettonMinter.getTotalSupply();
        let initialJettonBalance = toNano('1000.23');

        const mintResult = await jettonMinter.sendMint(
            deployer.getSender(),
            testAccount.address,
            initialJettonBalance,
            toNano('0.05'),
            toNano('1'));

        expect(mintResult.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: accountJettonWallet.address,
            deploy: true,
        });
        expect(mintResult.transactions).toHaveTransaction({ // excesses
            from: accountJettonWallet.address,
            to: jettonMinter.address
        });
        expect(await accountJettonWallet.getJettonBalance()).toEqual(initialJettonBalance);
        expect(await jettonMinter.getTotalSupply()).toEqual(initialTotalSupply + initialJettonBalance);

        const res1 = await bridge.sendAddJetton(
            admin.getSender(),
            toNano('0.5'), [jettonMinter.address], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        let outMessage = res1.transactions[1].outMessages.get(0)?.body;
        console.log(outMessage);

        expect(await bridge.getIsJettonSupport(chainId, jettonMinter.address)).toBe(true);

        const res3 = await bridge.sendSetBridgePool(admin.getSender(), toNano('0.5'), [{
            jetton_address: jettonMinter.address,
            contract_address: poolAddress.address
        }, {
            jetton_address: testJettonAddress1,
            contract_address: poolAddress.address
        }]);
        expect(res3.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        expect(await bridge.getBridgePool(jettonMinter.address)).toEqualAddress(poolAddress.address);
        expect(await bridge.getBridgePool(testJettonAddress1)).toEqualAddress(poolAddress.address);

        let targetAddress = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
        const buffer = aelf.utils.base58.decode(targetAddress)

        let targetAddress1 = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const buffer1 = aelf.utils.base58.decode(targetAddress1)
        const res4 = await bridge.sendTargetContract(admin.getSender(), toNano('0.5'), [
            {
                chain_id: chainId,
                bridge_address: buffer
            },
            {
                chain_id: chainIdSide,
                bridge_address: buffer1
            }]);
        expect(res4.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        let contractAddress = await bridge.getTargetContractAddress(chainId);
        expect(aelf.utils.base58.encode(contractAddress)).toEqual(targetAddress);

        let contractAddress1 = await bridge.getTargetContractAddress(chainIdSide);
        expect(aelf.utils.base58.encode(contractAddress1)).toEqual(targetAddress1);

        initialState = blockchain.snapshot();

        curTime = () => blockchain.now ?? Math.floor(Date.now() / 1000);

    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('add_jetton_whitelist success', async () => {
        const res1 = await bridge.sendAddJetton(admin.getSender(), toNano('0.5'),
            [testJettonAddress1, testJettonAddress], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        let trans = findTransactionRequired(res1.transactions, {
            from: admin.address,
            to: bridge.address,
            success: true
        });
        expect(trans.outMessages.size).toBe(2);
        let event1 = trans.outMessages.get(0)?.body;
        if (event1 != undefined) {
            let a = event1.asSlice();
            let op = a.loadUint(32);
            let chain_id = a.loadUint(32);
            let jetton_address = a.loadAddress();
            expect(op).toBe(Op.bridge_event.JETTON_ADDED);
            expect(chain_id).toBe(chainId);
            expect(jetton_address).toEqualAddress(testJettonAddress1);
        }
        let event2 = trans.outMessages.get(1)?.body;
        if (event2 != undefined) {
            let a = event2.asSlice();
            let op = a.loadUint(32);
            let chain_id = a.loadUint(32);
            let jetton_address = a.loadAddress();
            expect(op).toBe(Op.bridge_event.JETTON_ADDED);
            expect(chain_id).toBe(chainId);
            expect(jetton_address).toEqualAddress(testJettonAddress);
        }

        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(true);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(true);
    });
    it('add_jetton_whitelist failed unauthorized', async () => {
        const res1 = await bridge.sendAddJetton(owner.getSender(), toNano('0.5'),
            [testJettonAddress1, testJettonAddress], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(false);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(false);
    });
    it('remove_jetton success', async () => {
        const res1 = await bridge.sendAddJetton(admin.getSender(), toNano('0.5'),
            [testJettonAddress1, testJettonAddress], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(true);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(true);

        let res = await bridge.sendRemoveJetton(admin.getSender(), toNano('0.5'), [testJettonAddress], chainId);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        let trans = findTransactionRequired(res.transactions, {
            from: admin.address,
            to: bridge.address,
            success: true
        });
        expect(trans.outMessages.size).toBe(1);
        let event1 = trans.outMessages.get(0)?.body;
        if (event1 != undefined) {
            let a = event1.asSlice();
            let op = a.loadUint(32);
            let chain_id = a.loadUint(32);
            let jetton_address = a.loadAddress();
            expect(op).toBe(Op.bridge_event.JETTON_REMOVED);
            expect(chain_id).toBe(chainId);
            expect(jetton_address).toEqualAddress(testJettonAddress);
        }
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(true);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(false);


    });
    it('remove_jetton failed unauthorized', async () => {
        const res1 = await bridge.sendAddJetton(admin.getSender(), toNano('0.5'),
            [testJettonAddress1, testJettonAddress], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(true);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(true);

        let res = await bridge.sendRemoveJetton(owner.getSender(), toNano('0.5'), [testJettonAddress], chainId);
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(true);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(true);
    });

    it('remove_jetton failed not support', async () => {
        let res = await bridge.sendRemoveJetton(admin.getSender(), toNano('0.5'), [testJettonAddress], chainId);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: false,
            exitCode: 85
        });
    });

    it('set bridge pool success', async () => {
        let res = await bridge.sendSetBridgePool(admin.getSender(), toNano('0.5'), [{
            jetton_address: testJettonAddress,
            contract_address: poolAddress.address
        }]);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        expect(await bridge.getBridgePool(testJettonAddress)).toEqualAddress(poolAddress.address);
    });
    it('set bridge pool failed unauthorized', async () => {
        let res = await bridge.sendSetBridgePool(owner.getSender(), toNano('0.5'), [{
            jetton_address: testJettonAddress,
            contract_address: poolAddress.address
        }]);
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
    });
    it('set target contract success', async () => {
        let targetAddress = "2rC1X1fudEkJ4Yungj5tYNJ93GmBxbSRiyJqfBkzcT6JshSqz9";
        const buffer = aelf.utils.base58.decode(targetAddress)

        const res = await bridge.sendTargetContract(admin.getSender(), toNano('0.5'), [
            {
                chain_id: 1,
                bridge_address: buffer
            }]);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        let contractAddress = await bridge.getTargetContractAddress(1);
        expect(aelf.utils.base58.encode(contractAddress)).toEqual(targetAddress);

    });
    it('set target contract failed unauthorized', async () => {
        let targetAddress = "2rC1X1fudEkJ4Yungj5tYNJ93GmBxbSRiyJqfBkzcT6JshSqz9";
        const buffer = aelf.utils.base58.decode(targetAddress)

        const res = await bridge.sendTargetContract(owner.getSender(), toNano('0.5'), [
            {
                chain_id: 1,
                bridge_address: buffer
            }]);
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
    });
    it('change_pause_controller success', async () => {
        let pauseControllerBefore = await bridge.getPauseController();
        expect(pauseControllerBefore).toEqualAddress(pauseController.address);

        let after = randomAddress();
        let res = await bridge.sendChangePauseController(admin.getSender(), toNano('0.5'), after);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        const pauseControllerAfter = await bridge.getPauseController();
        expect(pauseControllerAfter).toEqualAddress(after);
    });
    it('change_pause_controller failed unauthorized', async () => {
        let pauseControllerBefore = await bridge.getPauseController();
        expect(pauseControllerBefore).toEqualAddress(pauseController.address);

        let after = randomAddress();
        let res = await bridge.sendChangePauseController(owner.getSender(), toNano('0.5'), after);
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });

        const pauseControllerAfter = await bridge.getPauseController();
        expect(pauseControllerAfter).toEqualAddress(pauseController.address);
    });
    it('change_oracle_address success', async () => {
        let add = randomAddress();
        let res = await bridge.sendSetOracleAddress(admin.getSender(), toNano('0.5'), add);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        let oracle = await bridge.getOracleAddress();
        expect(oracle).toEqualAddress(add);
    });
    it('change_oracle_address failed unauthorized', async () => {
        let add = randomAddress();
        let res = await bridge.sendSetOracleAddress(owner.getSender(), toNano('0.5'), add);
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
        let oracle = await bridge.getOracleAddress();
        expect(oracle).not.toEqualAddress(add);
    });

    it('pause', async () => {
        let res = await bridge.sendPause(pauseController.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: pauseController.address,
            to: bridge.address,
            success: true,
        });

        const status = await bridge.getPaused();
        expect(status).toBe(true);
    });
    it('pause failed unauthorized', async () => {
        let res = await bridge.sendPause(owner.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });

        const status = await bridge.getPaused();
        expect(status).toBe(false);
    });

    it('restart', async () => {
        let res = await bridge.sendPause(pauseController.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: pauseController.address,
            to: bridge.address,
            success: true,
        });

        const status = await bridge.getPaused();
        expect(status).toBe(true);

        let res1 = await bridge.sendRestart(admin.getSender(), toNano('0.5'));

        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        const status1 = await bridge.getPaused();
        expect(status1).toBe(false);
    });
    it('restart failed unauthorized', async () => {
        let res = await bridge.sendPause(pauseController.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: pauseController.address,
            to: bridge.address,
            success: true,
        });

        const status = await bridge.getPaused();
        expect(status).toBe(true);

        let res1 = await bridge.sendRestart(owner.getSender(), toNano('0.5'));

        expect(res1.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });

        const status1 = await bridge.getPaused();
        expect(status1).toBe(true);
    });

    it('transmit success', async () => {
        let receipt_index = 1;
        console.log(convertLong(receipt_index).toString('base64'));
        let key_hash = createHash('sha256').update('test').digest();
        let receipt_amount = 100;
        const receiver = Buffer.from(admin.address.toString(), 'base64');
        const timestamp = Math.floor(Date.now() / 1000);
        let dataFullBuffer = generateMessage(key_hash, receipt_amount, receiver.toString('base64'), receipt_index, timestamp);
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        console.log(dataFullBuffer.toString('base64'));
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let target = bridge.address;
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            target,
            data,
            dataOther,
            beginCell().storeUint(1, 256).endCell(),
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: poolAddress.address,
            op: Op.bridge_pool.release,
            success: true
        });
    });

    it('transmit failed unauthorized', async () => {
        let receipt_index = 1;
        console.log(convertLong(receipt_index).toString('base64'));
        let key_hash = createHash('sha256').update('test').digest();
        let receipt_amount = 100;
        const receiver = Buffer.from(admin.address.toString(), 'base64');
        const timestamp = Math.floor(Date.now() / 1000);
        let dataFullBuffer = generateMessage(key_hash, receipt_amount, receiver.toString('base64'), receipt_index, timestamp);
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        console.log(dataFullBuffer.toString('base64'));
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let target = bridge.address;
        let result = await bridge.sendTransmit(
            owner.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            target,
            data,
            dataOther,
            beginCell().storeUint(1, 256).endCell(),
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
    });
    it('transmit success but release failed, resend to oracle success', async () => {
        let receipt_index = 1;
        console.log(convertLong(receipt_index).toString('base64'));
        let key_hash = createHash('sha256').update('test').digest();
        let receipt_amount = 100;
        const receiver = Buffer.from(admin.address.toString(), 'base64');
        const timestamp = Math.floor(Date.now() / 1000);
        const receiptHash = calculateReceiptHashForTon(key_hash, receipt_amount, receiver.toString('base64'), receipt_index);
        let dataFullBuffer = generateMessage(key_hash, receipt_amount, receiver.toString('base64'), receipt_index, timestamp);
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        console.log(dataFullBuffer.toString('base64'));
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let target = bridge.address;
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            target,
            data,
            dataOther,
            beginCell().storeUint(1, 256).endCell(),
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: poolAddress.address,
            op: Op.bridge_pool.release,
            success: true
        });
        let res1 = await bridge.sendResendToOracle(
            poolAddress.getSender(),
            toNano('0.5'),
            jettonMinter.address,
            messageId,
            BigInt('0x' + receiptHash.toString('hex')),
            timestamp,
            1,
            600
        );
        expect(res1.transactions).toHaveTransaction({
            from: poolAddress.address,
            to: bridge.address,
            success: true,
        });
    });
    it('receipt_ok success', async () => {
        let aelfTarget = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let res = await bridge.sendReceiptOk(
            poolAddress.getSender(),
            toNano('0.05'),
            chainId,
            admin.address,
            jettonMinter.address,
            aelfTarget,
            100,
            beginCell().storeUint(111, 256).storeUint(1, 64).endCell(),
            1
        );
        expect(res.transactions).toHaveTransaction({
            from: poolAddress.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        let trans = findTransactionRequired(res.transactions, {
            from: poolAddress.address,
            to: bridge.address,
            success: true
        });
        let event = trans.outMessages.get(1)?.body;
        if (event != undefined) {
            let a = event.asSlice();
            let op = a.loadUint(32);
            let chain_id = a.loadUint(32);
            let amount = a.loadCoins();
            let addressCell = a.loadRef();
            let sli = addressCell.asSlice();
            let owner = sli.loadAddress();
            let jetton_address = sli.loadAddress();
            let target = sli.loadBuffer(32);
            expect(op).toBe(Op.bridge_event.NEW_RECEIPT);
            expect(chain_id).toBe(chainId);
            expect(amount).toBe(100n);
            expect(owner).toEqualAddress(admin.address);
            expect(jetton_address).toEqualAddress(jettonMinter.address);
            expect(aelf.utils.base58.encode(target)).toEqual("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        }
    });
    it('receipt_ok failed unauthorized', async () => {
        let aelfTarget = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let res = await bridge.sendReceiptOk(
            owner.getSender(),
            toNano('0.05'),
            chainId,
            admin.address,
            jettonMinter.address,
            aelfTarget,
            100,
            beginCell().storeUint(111, 256).storeUint(1, 64).endCell(),
            1
        );
        expect(res.transactions).toHaveTransaction({
            from: owner.address,
            to: bridge.address,
            success: false,
            exitCode: 81
        });
    });

});

function computeHash(data: Buffer): Buffer {
    return createHash('sha256').update(data).digest();
}

function convertLong(data: number, byteSize: number = 32): Buffer {
    let b = Buffer.alloc(8);
    b.writeBigInt64BE(BigInt(data));
    if (b.length === byteSize) {
        return b;
    }

    let diffCount = byteSize - b.length;
    let longDataBytes = Buffer.alloc(byteSize, data < 0 ? 0xFF : 0x00);

    b.copy(longDataBytes, diffCount);

    return longDataBytes;
}

function calculateReceiptHashForTon(
    receiptIdToken: Buffer,
    amount: number,
    targetAddress: string,
    receiptIndex: number
): Buffer {
    const addressHash = computeHash(Buffer.from(targetAddress, 'base64'));
    const amountTon = convertLong(amount);
    const amountHash = computeHash(amountTon);
    const receiptIndexTon = convertLong(receiptIndex);
    const receiptIndexHash = computeHash(receiptIndexTon);
    const receiptIdHash = computeHash(Buffer.concat([receiptIdToken, receiptIndexHash]));

    return computeHash(Buffer.concat([receiptIdHash, amountHash, addressHash]));
}

function fillObservationBytes(data: Buffer, slotSize: number): Buffer {
    if (data.length > slotSize) throw new Error(`Data exceeds slot size: ${slotSize}`);
    const filledBuffer = Buffer.alloc(slotSize);
    data.copy(filledBuffer);
    return filledBuffer;
}

function generateMessage(receiptIdToken: Buffer, amount: number, targetAddress: string, receiptIndex: number, timestamp: number): Buffer {
    const receiptHash = calculateReceiptHashForTon(receiptIdToken, amount, targetAddress, receiptIndex);
    const targetAddressBuffer = Buffer.from(targetAddress, 'base64');

    const lazyData = Buffer.concat([
        fillObservationBytes(convertLong(receiptIndex), 32),
        fillObservationBytes(receiptIdToken, 32),
        fillObservationBytes(convertLong(amount), 32),
        fillObservationBytes(receiptHash, 32),
        fillObservationBytes(targetAddressBuffer, 36),
        fillObservationBytes(convertLong(timestamp, 8), 8)
    ]);

    return lazyData;
}