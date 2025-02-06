import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, toNano} from '@ton/core';
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
import {Op} from "../wrappers/constants";

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

    let swapAddress: SandboxContract<TreasuryContract>;
    let poolAddress: SandboxContract<TreasuryContract>;
    let swapSideAddress: SandboxContract<TreasuryContract>;
    let poolSideAddress: SandboxContract<TreasuryContract>;
    let oracleAddress: Address;
    let pauseController: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let testAccount: SandboxContract<TreasuryContract>
    let owner: SandboxContract<TreasuryContract>;
    let tempUpgrade: Cell;
    let bridgeReceiptAccountCode: Cell;
    let targetContractDic: Dictionary<any, any>;
    let initialState: BlockchainSnapshot;
    let curTime: () => number;
    const chainId = 9992731;
    const chainIdSide = 6662731;

    beforeAll(async () => {
        code = await compile('Bridge');
        jwallet_code = await compile('JettonWallet');
        minter_code = await compile('JettonMinter');
        bridgeReceiptAccountCode = await compile('BridgeReceiptAccount');
        blockchain = await Blockchain.create();
        pauseController = await blockchain.treasury('pause');
        testJettonAddress1 = randomAddress();
        testJettonAddress = randomAddress();
        testJettonAddress2 = randomAddress();
        oracleAddress = randomAddress();
        swapAddress = await blockchain.treasury('BridgeSwap');
        swapSideAddress = await blockchain.treasury('BridgeSwapSide');
        poolAddress = await blockchain.treasury('BridgePool');
        poolSideAddress = await blockchain.treasury('BridgePoolSide');
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
        let swapContractDicDefault = Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.Address());
        let jettonWhitelistDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        let targetContractDicDefault = Dictionary.empty();
        bridge = blockchain.openContract(Bridge.createFromConfig({
            bridge_swap_address_dic: swapContractDicDefault,
            bridge_pool_address_dic: poolContractDicDefault,
            oracle_address: oracleAddress,
            jetton_whitelist_dic: jettonWhitelistDicDefault,
            is_pause: false,
            pause_controller: pauseController.address,
            admin: admin.address,
            owner: owner.address,
            temp_upgrade: tempUpgrade,
            bridge_receipt_account_code: bridgeReceiptAccountCode,
            target_contract_dic: targetContractDicDefault
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

        const res2 = await bridge.sendSetBridgeSwap(admin.getSender(), toNano('0.5'), [{
            jetton_address: testJettonAddress,
            contract_address: swapAddress.address
        }, {
            jetton_address: testJettonAddress1,
            contract_address: swapSideAddress.address
        }]);
        console.log(testJettonAddress);
        console.log(swapAddress.address);

        expect(res2.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        let outMessage1 = res2.transactions[1].outMessages.get(0)?.body;
        console.log(outMessage1);
        if (outMessage1 != undefined) {
            let a = outMessage1.asSlice();
            let jetton_address = a.loadAddress();
            console.log(jetton_address);
            let contract_address = a.loadAddress();
            console.log(contract_address);
        }


        let get_res = await bridge.getBridgeSwap(testJettonAddress);
        expect(get_res).toEqualAddress(swapAddress.address);
        let get_res1 = await bridge.getBridgeSwap(testJettonAddress1);
        expect(get_res1).toEqualAddress(swapSideAddress.address);

        const res3 = await bridge.sendSetBridgePool(admin.getSender(), toNano('0.5'), [{
            jetton_address: jettonMinter.address,
            contract_address: poolAddress.address
        }, {
            jetton_address: testJettonAddress1,
            contract_address: poolSideAddress.address
        }]);
        expect(res3.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        expect(await bridge.getBridgePool(jettonMinter.address)).toEqualAddress(poolAddress.address);
        expect(await bridge.getBridgePool(testJettonAddress1)).toEqualAddress(poolSideAddress.address);

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

    it('set oracle ', async () => {
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
    it('set_bridge_swap batch', async () => {
        let input = [];
        for (let i = 0; i < 100; i++) {
            input.push({
                jetton_address: randomAddress(),
                contract_address: randomAddress()
            });
        }
        const res2 = await bridge.sendSetBridgeSwap(admin.getSender(), toNano('0.5'), input);
        expect(res2.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        const res3 = await bridge.sendSetBridgePool(admin.getSender(), toNano('0.5'), input);
        expect(res3.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        let address = [];
        for (let i = 0; i < 100; i++) {
            address.push(randomAddress());
        }
        const res4 = await bridge.sendAddJetton(admin.getSender(), toNano('0.5'), address, chainId);
        expect(res4.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });


        let address1 = [];
        for (let i = 0; i < 100; i++) {
            address1.push(randomAddress());
        }
        const res5 = await bridge.sendAddJetton(admin.getSender(), toNano('0.5'), address1, chainId);
        expect(res5.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        for (let i = 0; i < address1.length; i++) {
            expect(await bridge.getIsJettonSupport(chainId, address[i])).toBe(true);
            expect(await bridge.getIsJettonSupport(chainId, address1[i])).toBe(true);
        }
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

    it('remove_jetton', async () => {
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
        // let body = res.transactions[1].outMessages.get(0)?.body;
        // console.log(res.transactions[1].outMessages);
        // if (body != undefined) {
        //     let a = body.asSlice();
        //     let chain_id = a.loadUint(32);
        //     let jetton_address = a.loadAddress();
        //     console.log(chain_id);
        //     console.log(jetton_address);
        //     console.log(body);
        // }
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress1)).toBe(true);
        expect(await bridge.getIsJettonSupport(chainId, testJettonAddress)).toBe(false);


    })

    it('change_pause_controller', async () => {
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

    it('create_receipt', async () => {
        let res = await bridge.sendGetterBridgeSwap(testAccount.getSender(), toNano('0.5'),testJettonAddress);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: testAccount.address,
            success: true,
        });
        let body = res.transactions[1].outMessages.get(0)?.body;
        if (body != undefined) {
            let bodySlice = body.asSlice();
            let op = bodySlice.loadUint(32);
            let queryId = bodySlice.loadUint(64);
            let jetton = bodySlice.loadAddress();
            let swap = bodySlice.loadAddress();
            console.log(swap);
            expect(swap).toEqualAddress(swapAddress.address);
        }
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        const testAccountJettonWallet = await userWallet(testAccount.address);
        const bridgeJettonWallet = await userWallet(bridge.address);

        let initialJettonBalance = await testAccountJettonWallet.getJettonBalance();
        expect(initialJettonBalance).toEqual(toNano('1000.23'));
        let receipt_amount = toNano('10');
        let forwardAmount = toNano('0.15');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, testAccountJettonWallet.address,
            targetAddressBuffer, jettonMinter.address);
        console.log(testAccount.address);
        console.log(testAccountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgeJettonWallet.address);
        console.log(poolAddress.address);
        // EQBvA4zKQaQOjwu7HbyHiWJU7xQyzV4hre1YXq2PzVR2UTyT
        // EQATaFDN2c9RdodUJ1eHXcDW6NIbD0XNY1LXnj2-a3qZEyoa
        // EQB3wiY8FeWPuUWqZoDfsGSiBb2LT-qR43m5OdQDmduZpVMn
        // EQBRH_TSN1jw9W7UWxxg_IxBJp_F8lEkc8Wnthd3JmKES4MF
        //EQCiPtvtOIdmUkfM-vfh11m0CVi1cTfURzvx1a4VIw9B8dH4
        const result = await testAccountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('2'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            null,
            forwardAmount,
            payload);

        expect(result.transactions).toHaveTransaction({
            from: testAccountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        let balance = await testAccountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('990.23'));
    });
    
    it('create_receipt failed token not support', async () => {
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        const testAccountJettonWallet = await userWallet(testAccount.address);
        const bridgeJettonWallet = await userWallet(bridge.address);

        let initialJettonBalance = await testAccountJettonWallet.getJettonBalance();
        expect(initialJettonBalance).toEqual(toNano('1000.23'));
        let receipt_amount = toNano('10');
        let forwardAmount = toNano('0.15');
        let payload = Bridge.PackCreateReceiptBody(
            12345, testAccountJettonWallet.address,
            targetAddressBuffer, jettonMinter.address);
        const result = await testAccountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('2'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            null,
            forwardAmount,
            payload);
        
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: testAccountJettonWallet.address,
            success: true,
        });
        let tx = findTransactionRequired(result.transactions, {
            on: bridge.address,
            from: bridgeJettonWallet.address,
            success: true
        });
        console.log(tx);
        for (let i = 0; i < tx.outMessages.size; i++) {
            console.log(tx.outMessages.get(i));
            console.log(tx.outMessages.get(i)?.info);
            console.log(tx.outMessages.get(i)?.info?.dest.value);
            // if (tx.outMessages.get(i)?.info?.dest.value != undefined && tx.outMessages.get(i)?.info?.dest.value == Op.bridge_pool_event.LOCKED) {
            //     let body = tx.outMessages.get(i)?.body;
            //     if (body != undefined) {
            //         let lockInfo = body.asSlice();
            //         let eventId = lockInfo.loadUint(32);
            //         console.log(eventId);
            //         let targetChainId = lockInfo.loadUint(32);
            //         console.log(targetChainId);
            //         let amount = lockInfo.loadCoins();
            //         console.log(amount);
            //         let addressInfo = lockInfo.loadRef().asSlice();
            //         let owner = addressInfo.loadAddress();
            //         console.log(owner);
            //         let jettonAddress = addressInfo.loadAddress();
            //         console.log(jettonAddress);
            //         let targetAddress = addressInfo.loadBuffer(32);
            //         let add = aelf.utils.base58.encode(targetAddress);
            //         console.log(add);
            //     }
            // }
        }
    });
    it('create_native_receipt', async () => {
    });

    it('transmit', async () => {

    });
    it('resend to oracle', async () => {

    });

    it('swap ok', async () => {
    });

    it('init code upgrade', async () => {
        // let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        // const buffer = bs58.decode(targetAddress);
        // console.log(buffer.length);
        // let code = await compile('MockBridge');
        // let res = await bridge.sendInitCodeUpgrade(owner.getSender(), toNano('0.5'), code);
        // expect(res.transactions).toHaveTransaction({
        //     from: owner.address,
        //     to: bridge.address,
        //     success: true,
        // });
        // await sleep(3600);
        // let res1 = await bridge.sendFinalizeUpgradeCode(owner.getSender(), toNano('0.5'));
        // expect(res1.transactions).toHaveTransaction({
        //     from: owner.address,
        //     to: bridge.address,
        //     success: true,
        // });
        // let res2 = await bridge.sendAddJetton(admin.getSender(), toNano('0.5'),
        //     [testJettonAddress1, testJettonAddress], chainId);
        // expect(res2.transactions).toHaveTransaction({
        //     from: admin.address,
        //     to: bridge.address,
        //     success: false,
        //     exitCode: 65535
        // });
        // let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        // let a = aelf.utils.base58.decode(targetAddress);
        // console.log(a.length);
        // let body1 = "te6cckEBBgEAsQADYwAAAAAAAAAIAAAAAACYehuAAcAGjwbmoIq6yiXXV+hBsNzNWuizIv+auXN/ct6twbVQAQIDAEAnVYqioDbqrPp0DblFmpKQlOhf8haPvsKR0K0QlRGwoQAIAJh6GwIQAAAAAACYehsEBQBA+irfLovtPvUXkHKcIFchJ4wUqsK3hBrKWOQsThTxK3gAQ4AezFkJ0uBZQfW0gCmB7LSvC2motKISGb18aEc0/pD2unBADJww";
        // let c = Cell.fromBase64(body1);
        // console.log(c);
        // let sli = c.asSlice();
        // let op = sli.loadUint(32);
        // let chain_id = sli.loadUint(64);
        // let target_contract = sli.loadRef().asSlice();
        // console.log(target_contract.remainingBits);
        // console.log()
        // let target = target_contract.loadBuffer(32);
        // console.log(aelf.utils.base58.encode(target));
        // let message = sli.loadRef().asSlice();
        // let convert = sli.loadRef().asSlice();
        // let chain_id_convert = convert.loadUint(64);
        // let target_contract_convert = convert.loadRef().asSlice()
        // console.log(target_contract_convert.remainingBits);
        // let a = target_contract_convert.loadBuffer(32);
        // console.log(aelf.utils.base58.encode(a));

    });
    it('parse', async () => {
        let body = "te6cckECCwEAAd4AAUgAAAADas3a1zm80gRLKasMV3nFdOe9pP3MM6DtvsTuTMaBKt0BBCAAAAAAAB16mAAAAAAAAARMAgMEBQBAJ1WKoqA26qz6dA25RZqSkJToX/IWj77CkdCtEJURsKEAQ4AbKvHjfpgXOGoaFih6bLkxVI2duu9jZl49a1TiFSaCirABxgMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADvF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmJaAAQYEUAAAAAAAAARMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHCAkKAI4CIFnQFwiBUY3kILgEp48D/cot7wXzZjIbtRFkOwAKf0nR0QAE3Pe/crm24aW5NdyhbKWw3l3bOgm0EYTlq+VHJbCDr7ZyAABA6akJ+WNN/7uYAH2YHHjbc11djaEkxzpWPI9gK/jdDnsAYEVRRFpWNDhiOU1DNXcxRFFzVVBUWmNtS3BHenQxM3NiTXZIcldxY1FxVFFVVmRyUgBDgApFKW+ybaDZ+I1Dd64y0VT5uCj26GOrQaqTrOZKcrv+kAAIVVNEVIKPl4M=";
        let c = Cell.fromBase64(body);
        let sli = c.asSlice();
        let op = sli.loadUint(32);
        let messageId = sli.loadUintBig(256);
        let originData = sli.loadRef();
        let originDataSlice = originData.asSlice();
        let chainId = originDataSlice.loadUint(64);
        let targetChainId = originDataSlice.loadUint(64);
        let sender1 = originDataSlice.loadRef();
        let sender1Slice = sender1.asSlice();
        let sender = sender1Slice.loadBuffer(32);
        console.log(aelf.utils.base58.encode(sender));
        let receiver1 = originDataSlice.loadRef();
        let receiver1Slice = receiver1.asSlice();
        let receiver = receiver1Slice.loadAddress();
        console.log(receiver);
        let message = originDataSlice.loadRef();
        let messageSlice = message.asSlice();
        let sliceBits = messageSlice.loadUint(16);
        console.log(sliceBits);
        let data = messageSlice.loadBuffer(sliceBits / 8);
        console.log(data.toString('base64'));
        let ref = messageSlice.loadUint(8);
        let refInfo = messageSlice.loadRef();
        let refInfoSlice = refInfo.asSlice();
        sliceBits = refInfoSlice.loadUint(16);
        console.log(sliceBits);
        let data1 = refInfoSlice.loadBuffer(sliceBits / 8);
        console.log(data1.toString('base64'));
        
        // //
        //
        // let convert = originDataSlice.loadRef();
        // let convertSlice = convert.asSlice();
        // console.log(convertSlice);
        // let swapId = convertSlice.loadRef();
        // console.log(swapId.asSlice().loadBuffer(32).toString('base64'));
        // let targetChainId1 = convertSlice.loadUint(64);
        // let contract = convertSlice.loadRef();
        // let jetton = convertSlice.loadRef().asSlice();
        // console.log(jetton.loadAddress())
        // let body = "te6cckEBAgEAlAABncFLyB8AHXqYgAeKwY30STYJ9mOceh+JMoEOz65bwvvvMhLqU2smDI+VEAFIpS32TbQbPxGobvXGWiqfNwUe3Qx1aDVSdZzJTld/0NMS0CABAIDF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlnIFxHg==";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        // let eventId = b.loadUint(32);
        // let fromChainId = b.loadUint(32);
        // let toAddress = b.loadAddress();
        // console.log(toAddress);
        // let tokenAddress = b.loadAddress();
        // let amount = b.loadCoins();
        // let receipt = b.loadRef();
        // let receiptSlice = receipt.asSlice();
        // let keyHash = receiptSlice.loadBuffer(32);
        // let index = receiptSlice.loadUintBig(256);
        // console.log(keyHash.toString('hex'));
        // console.log(index);

        // let body = "te6cckEBAQEAKwAAUgAAAAlqzdrXObzSBEspqwxXecV0572k/cwzoO2+xO5MxoEq3QEAAAL5HIduxQ==";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        // let op = b.loadInt(32);
        // let messageId = b.loadIntBig(256);
        // let type = b.loadInt(8);
        // let min = b.loadInt(32);
        // console.log(min);
        // console.log(type);
        // console.log(messageId);

        
        // let body = "te6cckEBAwEAoAABcAVOhAIAAAAAAAAAACsZwiAjlExKm0chGJ3klCFMflbbRJ7baWjsEo+LW525AAAAXQAAAAAAAKjAAQFAZtKouC1Y+2hcZNOGsRxW+dgLmj1g4yro5sKyisN5beQCAIDF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAa/wSFVw==";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        //
        // let queryId = b.loadIntBig(256);
        //
        
        // let body ="te6cckEBAgEAnwABsx9VvS4AAAAAAAAAAIAKRSlvsm2g2fiNQ3euMtFU+bgo9uhjq0Gqk6zmSnK7/oRvQsELsH9GLRX5QBSIVhqVGNKiCsUy9plkYSiDqbXUYAAAAAAAFTjgAAALEAEAgMXn8rgaMs6DXgS38stbrH0DVEGKufFlFjYsROLCJC1rAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADHySbvV";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        // let op = b.loadUint(32);
        // let queryId = b.loadUintBig(64);
        // let tokenAddress = b.loadAddress();
        // let messageId = b.loadUintBig(256);
        // let second = b.loadUint(64);
        // let exitCode = b.loadUint(32);
        // let receipt = b.loadRef();
        // let receiptSlice = receipt.asSlice();
        // let keyHash = receiptSlice.loadBuffer(32);
        // let index = receiptSlice.loadUintBig(256);
        // console.log(keyHash.toString('hex'));
        // console.log(index);
        // console.log(exitCode);
        // console.log(second);
        // console.log(messageId);
        // console.log(tokenAddress);
        // console.log(queryId);
        // console.log(op);

        // let body = "te6cckEBAQEAKwAAUgAAAAkZgG0tcykc56aIzJnHAcpIhDOGHASvPnhVNY3JDNkUVwEAAAMP9AURXQ==";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        // let op = b.loadUint(32);
        // let messageId = b.loadIntBig(256);
        // let exitCode = b.loadUint(32);
        // let time = b.loadUint(64);
        // console.log(time);
        // console.log(exitCode);
        // console.log(messageId);
        // let receipt = b.loadRef();
        // let receiptSlice = receipt.asSlice();
        // let keyHash = receiptSlice.loadBuffer(32);
        // let index = receiptSlice.loadUintBig(256);
        // console.log(keyHash.toString('hex'));
        // console.log(index);
        
        // let body = "te6cckEBAgEAlAABncFLyB8AHXqYgAeKwY30STYJ9mOceh+JMoEOz65bwvvvMhLqU2smDI+VEAFIpS32TbQbPxGobvXGWiqfNwUe3Qx1aDVSdZzJTld/0MBhqCABAIDF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeQCzV8w==";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        // let op = b.loadUint(32);
        // let chainId = b.loadUint(32);
        // let owner = b.loadAddress();
        // let jetton = b.loadAddress();
        // let amount = b.loadCoins();
        // let receipt = b.loadRef();
        // let receiptSlice = receipt.asSlice();
        // let keyHash = receiptSlice.loadBuffer(32);
        // let index = receiptSlice.loadUintBig(256);
        // console.log(keyHash.toString('hex'));
        // console.log(index);
        // console.log(amount);
        // console.log(jetton);
        // console.log(owner);
        // console.log(chainId);
        
        // let body = "te6cckEBAgEAawABcdNCAoAAAAAAAAAHiwAdepgAAAAAM6sZgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcnDgQAEAWQAdepiAAAAAM6sZgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcnDgQPpfq+8=";
        // let c = Cell.fromBase64(body);
        // let b = c.asSlice();
        // let op = b.loadUint(32);
        // let queryId = b.loadUintBig(64);
        // let chainId = b.loadUint(32);
        // let limitType = b.loadUint(1);
        // let refreshTime = b.loadUint(64);
        // let dailyLimit = b.loadUint(256);
        // console.log(dailyLimit);
        // console.log(refreshTime);
        // console.log(chainId);
        // console.log(queryId);
        // console.log(op);
        // console.log(limitType);
    });

    it('parse message', async () => {
        let body = "te6cckEBAQEAJgAASP////8FToQCAAAAAAAAAADyGdXePQDmvwaeSE4Vtj4LwmkW/jdr4gY=";
        let c = Cell.fromBase64(body);
        let sli = c.asSlice();
        console.log(sli);
        let op = sli.loadUint(32);
        let opCode = sli.loadUint(32);
        let queryId = sli.loadUint(64);
        console.log(op);
        console.log(opCode);
        console.log(queryId);
        
    });

});


/**
 * // let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
 *         // const buffer = bs58.decode(targetAddress);
 *         // console.log(buffer.length);
 *         // const bitString = new BitString(Buffer.from(buffer), 0, buffer.length * 8);
 *         // let targetContractDicTmp = Dictionary.empty(Dictionary.Keys.Int(32),Dictionary.Values.BitString(buffer.length * 8));
 *         // targetContractDicTmp.set(chainId,bitString);
 *         // targetContractDic = targetContractDicTmp;
 *         // let swapContractDic = Dictionary.empty(Dictionary.Keys.BigUint(256),Dictionary.Values.Address());
 *         // let swap = BigInt("0x" + testJettonAddress.hash.toString('hex'));
 *         // swapContractDic.set(swap, swapAddress.address);
 *         // let poolContractDic = Dictionary.empty(Dictionary.Keys.BigUint(256),Dictionary.Values.Address());
 *         // let pool = BigInt("0x" + testJettonAddress.hash.toString('hex'));
 *         // poolContractDic.set(pool, poolAddress.address);
 *         // let jetton = BigInt("0x" + testJettonAddress.hash.toString('hex'));
 *         // let key = beginCell()
 *         //     .storeUint(testJettonAddress.workChain, 8)
 *         //     .storeUint(chainId,32)
 *         //     .storeUint(jetton,256)
 *         //     .endCell();
 *         // const hash = key.hash();
 *         // let hashInt = BigInt("0x" + hash.toString('hex'));
 *         // let jetton1 = BigInt("0x" + testJettonAddress1.hash.toString('hex'));
 *         // let key1 = beginCell()
 *         //     .storeUint(testJettonAddress1.workChain, 8)
 *         //     .storeUint(chainId,32)
 *         //     .storeUint(jetton1,256)
 *         //     .endCell();
 *         // const hash1 = key1.hash();
 *         // let hashInt1 = BigInt("0x" + hash1.toString('hex'));
 *         // console.log(hashInt1);
 *         // let jettonWhitelistDic = Dictionary.empty(Dictionary.Keys.BigUint(256),Dictionary.Values.Cell());
 *         // jettonWhitelistDic.set(hashInt,beginCell().storeBit(true).endCell());
 *         // jettonWhitelistDic.set(hashInt1,beginCell().storeBit(true).endCell());
 *         // console.log(admin.address);
 */