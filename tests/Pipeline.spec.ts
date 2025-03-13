import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, storeStateInit, toNano, Transaction} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import {BridgePool} from '../wrappers/BridgePool';
import '@ton/test-utils';
import {compile} from '@ton/blueprint';
import {Buffer} from "buffer";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgePoolLiquidityAccount} from "../wrappers/BridgePoolLiquidityAccount";
import aelf from "aelf-sdk";
import {
    computedGeneric,
    GasPrices,
    StorageValue,
    MsgPrices,
    getMsgPrices,
    getGasPrices,
    getStoragePrices, computeGasFee, collectCellStats, computeMessageForwardFees
} from "../wrappers/gasUtils";
import {findTransaction, findTransactionRequired} from "@ton/test-utils";
import {Op} from "../wrappers/constants";
import exp from "constants";

let send_transfer_gas_fee: bigint;
let send_internal_transfer_gas_fee: bigint;
let send_transfer_to_bridge_gas_fee: bigint;
let send_notification_create_receipt_gas_fee: bigint;
let send_transfer_to_bridge_wallet_gas_fee: bigint;
let send_internal_transfer_to_bridge_pool_gas_fee: bigint;
let send_notification_lock_gas_fee: bigint;
let send_receipt_ok_gas_fee: bigint;
let send_to_oracle_gas_fee: bigint;
let send_transmit_gas_fee: bigint;
let send_release_gas_fee: bigint;
let send_transfer_to_gas_fee: bigint;
let send_transfer_to_account_gas_fee: bigint;
let send_transfer_to_account_notification_gas_fee: bigint;
let send_receive_gas_fee: bigint;
let send_add_liquidity_gas_fee: bigint;
let send_remove_liquidity_gas_fee: bigint;
let send_add_native_liquidity_gas_fee: bigint;
let add_liquidity_gas_fee: bigint;
let provider_liquidity_gas_fee: bigint;
let min_tons_for_storage: bigint;

let send_create_native_receipt_gas_fee: bigint;
let send_lock_native_token_gas_fee: bigint;
let send_ton_to_user_gas_fee: bigint;

let user_remove_liquidity_gas_fee: bigint;
let remove_liquidity_gas_fee: bigint;


describe('Pipeline', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let initialState: BlockchainSnapshot;
    let curTime: () => number;
    const chainId = 9992731;
    // jetton
    let jwallet_code: Cell;
    let minter_code: Cell;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let userWallet: any;
    let defaultContent: Cell;
    let deployJettonWallet: any;
    let bridgeJettonWallet: any;
    let bridgePoolJettonWallet: any;
    let accountJettonWallet: any;
    let initialAccountJettonBalance = toNano('1000.23');
    // code
    let bridge_code: Cell;
    let bridgePool_code: Cell;
    let bridgeLiquidityAccountCode: Cell;
    // contract
    let bridge: SandboxContract<Bridge>;

    let bridgePool: SandboxContract<BridgePool>;
    let bridgePoolTonCoin: SandboxContract<BridgePool>;

    let bridgeLiquidityAccount: SandboxContract<BridgePoolLiquidityAccount>;
    // auth
    let admin: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let testAccount: SandboxContract<TreasuryContract>;
    // bridge helper
    let oracle: SandboxContract<TreasuryContract>;
    let pauseController: SandboxContract<TreasuryContract>;

    // bridge swap
    let swapId: Cell;
    let swapIdTonCoin: Cell;

    // upgrade
    let tempUpgrade: Cell;

    let HOLEADDRESS: Address;

    let msgPrices: MsgPrices;
    let gasPrices: GasPrices;
    let storagePrices: StorageValue;
    let storageDuration: number;
    let printTxGasStats: (name: string, trans: Transaction) => bigint;

    const jettonParams = {
        name: "Mock USDT",
        symbol: "USDT",
        description: "Test jetton",
    };

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        tempUpgrade = beginCell().endCell();
        deployer = await blockchain.treasury('deployer');
        admin = await blockchain.treasury('admin');
        owner = await blockchain.treasury('owner');
        testAccount = await blockchain.treasury('testAccount');

        bridge_code = await compile('Bridge');
        bridgePool_code = await compile('BridgePool');
        bridgeLiquidityAccountCode = await compile('BridgePoolLiquidityAccount');
        jwallet_code = await compile('JettonWallet');
        minter_code = await compile('JettonMinter');

        msgPrices = getMsgPrices(blockchain.config, 0);
        gasPrices = getGasPrices(blockchain.config, 0);
        storagePrices = getStoragePrices(blockchain.config);
        storageDuration = 5 * 365 * 24 * 3600;
        HOLEADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

        printTxGasStats = (name, transaction) => {
            const txComputed = computedGeneric(transaction);
            console.log(`${name} used ${txComputed.gasUsed} gas`);
            console.log(`${name} gas cost: ${txComputed.gasFees}`);
            return txComputed.gasFees;
        }

        // jetton
        // 1. deploy mock jetton contract
        // 2. deploy mock jetton wallet
        let metadata = JettonMinter.buildTokenMetadataCell({
            name: jettonParams.name,
            symbol: jettonParams.symbol,
            description: jettonParams.description,
        });
        jettonMinter = blockchain.openContract(
            await JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: metadata,
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
        // 3. deploy bridge contract
        oracle = await blockchain.treasury('oracle');
        pauseController = await blockchain.treasury('pauseController');
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
        }, bridge_code));
        const deployBridgeResult = await bridge.sendDeploy(deployer.getSender(), toNano('1'));
        expect(deployBridgeResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridge.address,
            deploy: true,
            success: true,
        });
        // 4. deploy bridge pool contract
        let dic = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        let receipt_dic = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Cell());
        bridgePool = blockchain.openContract(BridgePool.createFromConfig({
            bridge_address: bridge.address,
            jetton_address: jettonMinter.address,
            daily_limit: dic,
            rate_limit: dic,
            pool_liquidity_account_code: bridgeLiquidityAccountCode,
            admin: admin.address,
            owner: owner.address,
            temp_upgrade: tempUpgrade,
            swap_dict: dic,
            receipt_dict: receipt_dic,
            receipt_owner_dict: receiptRecordDic
        }, bridgePool_code));
        const deployPoolResult = await bridgePool.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deployPoolResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridgePool.address,
            deploy: true,
            success: true,
        });

        // 4'. deploy bridge pool contract for toncoin
        bridgePoolTonCoin = blockchain.openContract(BridgePool.createFromConfig({
            bridge_address: bridge.address,
            jetton_address: HOLEADDRESS,
            daily_limit: dic,
            rate_limit: dic,
            pool_liquidity_account_code: bridgeLiquidityAccountCode,
            admin: admin.address,
            owner: owner.address,
            temp_upgrade: tempUpgrade,
            swap_dict: dic,
            receipt_dict: receipt_dic,
            receipt_owner_dict: receiptRecordDic
        }, bridgePool_code));
        const deployPoolTonCoinResult = await bridgePoolTonCoin.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deployPoolTonCoinResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridgePoolTonCoin.address,
            deploy: true,
            success: true,
        });

        // 7. open liquidity account - test account
        const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        bridgeLiquidityAccount = blockchain.openContract(
            BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
        // init
        // 1. mint jetton to test account 
        deployJettonWallet = await userWallet(deployer.address);
        accountJettonWallet = await userWallet(testAccount.address);
        bridgeJettonWallet = await userWallet(bridge.address);
        bridgePoolJettonWallet = await userWallet(bridgePool.address);

        let initialTotalSupply = await jettonMinter.getTotalSupply();
        const mintResult = await jettonMinter.sendMint(
            deployer.getSender(),
            testAccount.address,
            initialAccountJettonBalance,
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
        expect(await accountJettonWallet.getJettonBalance()).toEqual(initialAccountJettonBalance);
        expect(await jettonMinter.getTotalSupply()).toEqual(initialTotalSupply + initialAccountJettonBalance);

        console.log("test account address", testAccount.address);
        console.log("bridge address", bridge.address);
        console.log("bridge pool address", bridgePool.address);
        console.log("bridge pool toncoin address", bridgePoolTonCoin.address);
        console.log("jetton minter address", jettonMinter.address);
        console.log("jetton wallet address", accountJettonWallet.address);
        console.log("bridge jetton wallet address", bridgeJettonWallet.address);
        console.log("bridge pool jetton wallet address", bridgePoolJettonWallet.address);
        console.log("oracle address", oracle.address);

        // bridge 
        // 1. add jetton whitelist
        const res1 = await bridge.sendAddJetton(
            admin.getSender(),
            toNano('0.5'), [jettonMinter.address, HOLEADDRESS], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        // 3. set bridge pool
        const res3 = await bridge.sendSetBridgePool(
            admin.getSender(), toNano('0.5'),
            [{
                jetton_address: jettonMinter.address,
                contract_address: bridgePool.address
            },
                {
                    jetton_address: HOLEADDRESS,
                    contract_address: bridgePoolTonCoin.address
                }]);
        expect(res3.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        expect(await bridge.getBridgePool(jettonMinter.address)).toEqualAddress(bridgePool.address);
        expect(await bridge.getBridgePool(HOLEADDRESS)).toEqualAddress(bridgePoolTonCoin.address);

        // 4. set target contract address
        let targetAddress = "foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz";
        const buffer = aelf.utils.base58.decode(targetAddress);
        const res4 = await bridge.sendTargetContract(admin.getSender(), toNano('0.5'), [
            {
                chain_id: chainId,
                bridge_address: Buffer.from(buffer)
            }]);
        expect(res4.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        let contractAddress = await bridge.getTargetContractAddress(chainId);
        expect(aelf.utils.base58.encode(contractAddress)).toEqual(targetAddress);
        // bridge swap
        // 1. create swap
        const result = await bridgePool.sendCreateSwap(
            admin.getSender(), toNano('0.5'), [{
                fromChainId: chainId,
                originShare: 1000,
                targetShare: 1
            }]);

        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        let body = result.transactions[1].outMessages.get(0)?.body;
        if (body != undefined) {
            let info = body.asSlice();
            let fromChainId = info.loadUint(32);
            let swapId_log = info.loadUintBig(256);
            console.log(fromChainId);
            console.log(swapId_log);
            swapId = beginCell().storeUint(swapId_log,256).endCell();
        }
        // 1'. create toncoin swap
        const resultTon = await bridgePoolTonCoin.sendCreateSwap(
            admin.getSender(), toNano('0.5'), [{
                fromChainId: chainId,
                originShare: 100,
                targetShare: 1
            }]);

        expect(resultTon.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        let bodyTon = resultTon.transactions[1].outMessages.get(0)?.body;
        if (bodyTon != undefined) {
            let info = bodyTon.asSlice();
            let fromChainId = info.loadUint(32);
            let swapId_log = info.loadUintBig(256);
            console.log(fromChainId);
            console.log(swapId_log);
            swapIdTonCoin = beginCell().storeUint(swapId_log,256).endCell();
        }
        // bridge pool
        // 1. set bridge address
        let res = await bridgePool.sendSetBridge(
            admin.getSender(), toNano('0.5'), bridge.address);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        const bridge1 = await bridgePool.getBridgeAddress();
        expect(bridge1).toEqualAddress(bridge.address);

        // 2. set jetton wallet
        let res5 = await bridgePool.sendSetJetton(
            admin.getSender(), toNano('0.5'), bridgePoolJettonWallet.address);
        expect(res5.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        let jetton = await bridgePool.getJettonAddress();
        expect(jetton.jettonAddress).toEqualAddress(jettonMinter.address);
        expect(jetton.poolJettonWalletAddress).toEqualAddress(bridgePoolJettonWallet.address);
        // 3. set daily limit
        let refreshTime = getUTCMidnight();
        let res6 = await bridgePool.sendSetDailyLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                refreshTime: refreshTime,
                dailyLimit: 100000000000000000n
            },
                {
                    chainId: chainId,
                    limitType: 1,
                    refreshTime: refreshTime,
                    dailyLimit: 100000000000000000n
                }]);
        expect(res6.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });


        const res8 = await bridgePool.getReceiptDailyLimit(chainId);
        expect(res8.remainToken).toBe(BigInt(100000000000000000));
        console.log(res8.refreshTime);
        expect(res8.dailyLimit).toBe(BigInt(100000000000000000));
        const res9 = await bridgePool.getSwapDailyLimit(chainId);
        expect(res9.remainToken).toBe(BigInt(100000000000000000));
        console.log(res9.refreshTime);
        expect(res9.dailyLimit).toBe(BigInt(100000000000000000));

        // 4. set rate limit
        let res7 = await bridgePool.sendSetRateLimit(
            admin.getSender(),
            toNano('1'),
            [{
                chainId: chainId,
                limitType: 0,
                tokenCapacity: 1000000000000000n,
                rate: 1000000000n,
            },
                {
                    chainId: chainId,
                    limitType: 1,
                    tokenCapacity: 1000000000000000n,
                    rate: 1000000000n,
                }]);
        expect(res7.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        const res10 = await bridgePool.getReceiptRateLimit(chainId);
        expect(res10.currentTokenAmount).toBe(BigInt(1000000000000000));
        expect(res10.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res10.rate).toBe(BigInt(1000000000));
        expect(res10.isEnable).toBe(true);

        const res11 = await bridgePool.getSwapRateLimit(chainId);
        expect(res11.currentTokenAmount).toBe(BigInt(1000000000000000));
        expect(res11.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res11.rate).toBe(BigInt(1000000000));
        expect(res11.isEnable).toBe(true);
        // add jetton liquidity
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('2');
        let payload = BridgePool.packAddLiquidityBody();
        const add_liquidity_res = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('5'),
            amount_add_liquidity,
            bridgePool.address,
            testAccount.address,
            null,
            forwardAmount,
            payload);

        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });

        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        const liquidity_account = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: liquidity_account,
            deploy: true,
            success: true,
        });

        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000));

        // 1. set bridge address
        let resTon = await bridgePoolTonCoin.sendSetBridge(
            admin.getSender(), toNano('0.5'), bridge.address);
        expect(resTon.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        const bridge2 = await bridgePoolTonCoin.getBridgeAddress();
        expect(bridge2).toEqualAddress(bridge.address);
        // 2. set jetton 
        let res6ton = await bridgePoolTonCoin.sendSetJetton(
            admin.getSender(), toNano('0.5'), HOLEADDRESS);
        expect(res6ton.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        let jetton1 = await bridgePoolTonCoin.getJettonAddress();
        expect(jetton1.jettonAddress).toEqualAddress(HOLEADDRESS);
        expect(jetton1.poolJettonWalletAddress).toEqualAddress(HOLEADDRESS);
        // 3. set daily limit
        let restonlimit = await bridgePoolTonCoin.sendSetDailyLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                refreshTime: refreshTime,
                dailyLimit: 10000000000000000n
            },
                {
                    chainId: chainId,
                    limitType: 1,
                    refreshTime: refreshTime,
                    dailyLimit: 10000000000000000n
                }]);
        expect(restonlimit.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });

        const res_get_1 = await bridgePoolTonCoin.getReceiptDailyLimit(chainId);
        expect(res_get_1.remainToken).toBe(BigInt(10000000000000000));
        console.log(res_get_1.refreshTime);
        expect(res_get_1.dailyLimit).toBe(BigInt(10000000000000000));
        const res_get_2 = await bridgePoolTonCoin.getSwapDailyLimit(chainId);
        expect(res_get_2.remainToken).toBe(BigInt(10000000000000000));
        console.log(res_get_2.refreshTime);
        expect(res_get_2.dailyLimit).toBe(BigInt(10000000000000000));

        // 4. set rate limit
        let res7ton = await bridgePoolTonCoin.sendSetRateLimit(
            admin.getSender(),
            toNano('1'),
            [{
                chainId: chainId,
                limitType: 0,
                tokenCapacity: 1000000000000000n,
                rate: 1000000000n,
            },
                {
                    chainId: chainId,
                    limitType: 1,
                    tokenCapacity: 1000000000000000n,
                    rate: 1000000000n,
                }]);
        expect(res7ton.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        const res10_get = await bridgePoolTonCoin.getReceiptRateLimit(chainId);
        expect(res10_get.currentTokenAmount).toBe(BigInt(1000000000000000));
        expect(res10_get.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res10_get.rate).toBe(BigInt(1000000000));
        expect(res10_get.isEnable).toBe(true);

        const res11_get = await bridgePoolTonCoin.getSwapRateLimit(chainId);
        expect(res11_get.currentTokenAmount).toBe(BigInt(1000000000000000));
        expect(res11_get.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res11_get.rate).toBe(BigInt(1000000000));
        expect(res11_get.isEnable).toBe(true);
        // add native token liquidity
        let resAddLiquidity = await bridgePoolTonCoin.sendAddNativeLiquidity(testAccount.getSender(), toNano('21'), toNano('20'));
        expect(resAddLiquidity.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        initialState = blockchain.snapshot();
        curTime = () => blockchain.now ?? Math.floor(Date.now() / 1000);
    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy and init', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('create receipt success pipeline', async () => {
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
        let receipt_amount = toNano('10');
        let forwardAmount = toNano('0.5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        const result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('0.7'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);

        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        let pool = await bridge.getBridgePool(jettonMinter.address);
        console.log(pool);
        // check result
        // 1. receipt info has been stored
        let receipt = await bridgePool.getReceiptInfo(chainId);
        expect(receipt.totalAmount).toBe(toNano('10'));
        expect(receipt.index).toBe(1n);
        // 2. check create receipt owner balance
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('890.23'));
        // 3. check pool balance
        let balance1 = await bridgePoolJettonWallet.getJettonBalance();
        expect(balance1).toEqual(toNano('110'));
        // 4. check bridge balance
        let balance2 = await bridgeJettonWallet.getJettonBalance();
        expect(balance2).toEqual(0n);
        // 5. check liquidity
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 + 10000000000));
        // 6. check limit
        const res3 = await bridgePool.getReceiptDailyLimit(chainId);
        expect(res3.remainToken).toBe(BigInt(100000000000000000 - 10000000000));
        console.log(res3.refreshTime);
        expect(res3.dailyLimit).toBe(BigInt(100000000000000000));
        const res4 = await bridgePool.getReceiptRateLimit(chainId);
        expect(res4.currentTokenAmount).toBeGreaterThanOrEqual(BigInt(1000000000000000 - 10000000000));
        expect(res4.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res4.rate).toBe(BigInt(1000000000));
        expect(res4.isEnable).toBe(true);
    });
    it("create native receipt success pipeline", async () => {
        let account_balance_before = await testAccount.getBalance();
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
        let receipt_amount = toNano('10');
        let res = await bridge.sendCreateNativeReceipt(testAccount.getSender(), toNano('10.5'), chainId, targetAddressBuffer, receipt_amount);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridgePoolTonCoin.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        let account_balance = await testAccount.getBalance();
        let diff = account_balance_before - account_balance;
        console.log(diff);
        expect(account_balance).toBeLessThan(account_balance_before - toNano('10'));

        let receipt = await bridgePoolTonCoin.getReceiptInfo(chainId);
        expect(receipt.totalAmount).toBe(toNano('10'));
        expect(receipt.index).toBe(1n);

        let liquidityAfter = await bridgePoolTonCoin.getPoolLiquidity();
        expect(liquidityAfter).toBe(toNano('30'));

        let bridgeBalance = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
        expect(bridgeBalance).toBeGreaterThanOrEqual(toNano('30'));
        console.log(bridgeBalance);

        const res3 = await bridgePoolTonCoin.getReceiptDailyLimit(chainId);
        expect(res3.remainToken).toBe(BigInt(10000000000000000 - 10000000000));
        console.log(res3.refreshTime);
        expect(res3.dailyLimit).toBe(BigInt(10000000000000000));

        const res4 = await bridgePoolTonCoin.getReceiptRateLimit(chainId);
        expect(res4.currentTokenAmount).toBeGreaterThanOrEqual(BigInt(1000000000000000 - 10000000000));
        expect(res4.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res4.rate).toBe(BigInt(1000000000));
        expect(res4.isEnable).toBe(true);
    });
    it('create receipt success repeated', async () => {
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);

        let receipt_amount1 = toNano('100');
        let forwardAmount1 = toNano('5');
        let payload1 = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);
        const result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount1,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount1,
            payload1);
        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        // check result
        // 1. receipt info has been stored
        let receipt1 = await bridgePool.getReceiptInfo(chainId);
        expect(receipt1.totalAmount).toBe(toNano('110'));
        expect(receipt1.index).toBe(2n);
        // 2. check create receipt owner balance
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('890.23') - toNano('100'));
        // 3. check pool balance
        let balance1 = await bridgePoolJettonWallet.getJettonBalance();
        expect(balance1).toEqual(toNano('110') + toNano('100'));
        // 4. check bridge balance
        let balance2 = await bridgeJettonWallet.getJettonBalance();
        expect(balance2).toEqual(0n);
        // 5. check liquidity
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 + 10000000000 + 100000000000));
        // 6. check limit
        const res3 = await bridgePool.getReceiptDailyLimit(chainId);
        expect(res3.remainToken).toBe(BigInt(100000000000000000 - 10000000000 - 100000000000));
        console.log(res3.refreshTime);
        expect(res3.dailyLimit).toBe(BigInt(100000000000000000));
        const res4 = await bridgePool.getReceiptRateLimit(chainId);
        expect(res4.currentTokenAmount).toBeGreaterThanOrEqual(BigInt(1000000000000000 - 10000000000 - 100000000000));
        expect(res4.tokenCapacity).toBe(BigInt(1000000000000000));
        expect(res4.rate).toBe(BigInt(1000000000));
        expect(res4.isEnable).toBe(true);

    });
    it('create receipt failed paused', async () => {
        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgeJettonWallet.address);

        let res = await bridge.sendPause(pauseController.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: pauseController.address,
            to: bridge.address,
            success: true,
        });
        const status = await bridge.getPaused();
        expect(status).toBe(true);
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        let result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);
        expect(result.transactions.length).toEqual(8);
        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: accountJettonWallet.address,
            success: true,
        });
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('900.23'));
    });
    it("create native receipt failed paused", async () => {
        console.log(testAccount.address);
        console.log(bridge.address);
        let account_balance_before = await testAccount.getBalance();

        let res = await bridge.sendPause(pauseController.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: pauseController.address,
            to: bridge.address,
            success: true,
        });
        const status = await bridge.getPaused();
        expect(status).toBe(true);
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
        let receipt_amount = toNano('10');
        let result = await bridge.sendCreateNativeReceipt(testAccount.getSender(), toNano('10.5'), chainId, targetAddressBuffer, receipt_amount);
        for (let i = 0; i < result.transactions.length; i++) {
            console.log(result.transactions[i].inMessage?.info.src?.toString());
            console.log(result.transactions[i].inMessage?.info.dest?.toString());
        }
        expect(result.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: testAccount.address,
            success: true,
        });
        let account_balance = await testAccount.getBalance();
        let diff = account_balance_before - account_balance;
        console.log(diff);
        expect(account_balance).toBeLessThan(account_balance_before);
        expect(account_balance).toBeGreaterThan(account_balance_before - toNano('1'));
    });
    it('create receipt failed jetton not support', async () => {
        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgeJettonWallet.address);

        let res = await bridge.sendRemoveJetton(admin.getSender(), toNano('0.5'), [jettonMinter.address], chainId);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });

        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        let result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);
        expect(result.transactions.length).toEqual(8);
        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: accountJettonWallet.address,
            success: true,
        });
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('900.23'));
    });
    it('create receipt failed error transfer op', async () => {
        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgeJettonWallet.address);

        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackFakeCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        let result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);
        expect(result.transactions.length).toEqual(8);
        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: accountJettonWallet.address,
            success: true,
        });
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('900.23'));
    });
    it('lock failed error limit', async () => {
        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgeJettonWallet.address);
        console.log(bridgePool.address);
        console.log(bridgePoolJettonWallet.address);

        let refreshTime = getUTCMidnight();
        let res = await bridgePool.sendSetDailyLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                refreshTime: refreshTime,
                dailyLimit: 10n
            }]);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        let result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);
        for (let i = 0; i < result.transactions.length; i++) {
            console.log(result.transactions[i].inMessage.info.src?.toString());
            console.log(result.transactions[i].inMessage.info.dest?.toString());
        }
        expect(result.transactions.length).toEqual(12);
        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true,
        });
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('900.23'));
    });
    it('lock native failed error limit', async () => {
        let refreshTime = getUTCMidnight();
        let restonlimit = await bridgePoolTonCoin.sendSetDailyLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                refreshTime: refreshTime,
                dailyLimit: 1000000000
            }]);
        let account_balance_before = await testAccount.getBalance();
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
        let receipt_amount = toNano('10');
        let res = await bridge.sendCreateNativeReceipt(testAccount.getSender(), toNano('10.5'), chainId, targetAddressBuffer, receipt_amount);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridgePoolTonCoin.address,
            to: testAccount.address,
            success: true,
        });
        let account_balance = await testAccount.getBalance();
        let diff = account_balance_before - account_balance;
        console.log(diff);
        expect(account_balance).toBeLessThan(account_balance_before);
        expect(account_balance).toBeGreaterThan(account_balance_before - toNano('1'));
    });
    it('receipt ok failed bounce', async () => {
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        const result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);

        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridge.address,
            success: false,
        });

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true,
            op: 0xffffffff,
        });

        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true,
        });
        // check result
        // 1. receipt info has been stored
        let receipt = await bridgePool.getReceiptInfo(chainId);
        expect(receipt.totalAmount).toBe(0n);
        expect(receipt.index).toBe(0n);
        // 2. check create receipt owner balance
        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('900.23'));
        // 3. check pool balance
        let balance1 = await bridgePoolJettonWallet.getJettonBalance();
        expect(balance1).toEqual(toNano('100'));
        // 5. check liquidity
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000));
    });
    it('swap success', async () => {
        let fee = await bridge.getEstimateSwapFee();
        console.log(fee);
        console.log(testAccount.address);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ9JGJg==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });

        const send_release_tx = findTransactionRequired(result.transactions, {
            on: bridgePool.address,
            from: bridge.address,
            op: Op.bridge_pool.release,
            success: true
        });
        send_release_gas_fee = printTxGasStats("release", send_release_tx);
        // gas used:36815
        send_release_gas_fee = computeGasFee(gasPrices, 36815n);
        console.log(send_release_gas_fee);

        // check
        // 1. check account balance
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 1000000000));
        // 2. check pool liquidity
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 - 1000000000));
        // 3. check pool jetton wallet balance
        expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(100000000000 - 1000000000));
        // 4. check swap
        let swap = await bridgePool.getSwapData(chainId);
        expect(swap.swapId).toEqual(swapId.beginParse().loadUintBig(256));
        expect(swap.swappedAmount).toBe(BigInt(1000000000));
        expect(swap.swappedTimes).toBe(1n);
    });
    it('swap native success', async () => {
        let account_balance_before = await testAccount.getBalance();
        let balanceBefore = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
        expect(balanceBefore).toBeGreaterThanOrEqual(toNano('20'));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ8F8+Q==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapIdTonCoin,
            HOLEADDRESS
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolTonCoin.address,
            to: testAccount.address,
            success: true
        });
        let liquidityAfter = await bridgePoolTonCoin.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(20000000000 - 10000000000));

        let balance = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
        expect(balance).toBeGreaterThanOrEqual(toNano('20') - toNano('10'));
        expect(balance).toBeLessThan(balanceBefore);

        let account_balance = await testAccount.getBalance();
        let diff = account_balance - account_balance_before;
        console.log(diff);
        expect(account_balance).toBe(account_balance_before + toNano('10'));
    });
    it('swap success repeated', async () => {
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ9JGJg==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(901230000000));
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        console.log(liquidityAfter);
        let dataFull1 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAArp97zAAucUeiOwqLAojROQ7erKl4BCk74mz4/6WEnpncRWOEjgRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ9JGJg==";
        let dataFullBuffer1 = Buffer.from(dataFull1, 'base64');
        let messageId1 = BigInt(2222);
        let data1 = dataFullBuffer1.slice(0, 96);
        let dataOther1 = dataFullBuffer1.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId1,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data1,
            dataOther1,
            swapId,
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });
        // check
        // 1. check account balance
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(901230000000 + 3000000000));
        // 2. check pool liquidity
        let liquidityAfter1 = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter1).toBe(BigInt(99000000000 - 3000000000));
        // 3. check pool jetton wallet balance
        expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(99000000000 - 3000000000));
        // 4. check swap
        let swap = await bridgePool.getSwapData(chainId);
        expect(swap.swapId).toEqual(swapId.beginParse().loadUintBig(256));
        expect(swap.swappedAmount).toBe(BigInt(4000000000));
        expect(swap.swappedTimes).toBe(2n);
    });
    it('swap failed paused', async () => {
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let res = await bridge.sendPause(pauseController.getSender(), toNano('0.5'));
        expect(res.transactions).toHaveTransaction({
            from: pauseController.address,
            to: bridge.address,
            success: true,
        });
        const status = await bridge.getPaused();
        expect(status).toBe(true);
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ6jHbA==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.01'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(result.transactions.length).toEqual(3);
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        let tx = findTransactionRequired(result.transactions, {
            on: bridge.address,
            from: oracle.address,
            op: Op.bridge.transmit,
            success: true
        });
        let body = tx.outMessages.get(0)?.body;
        if (body != undefined) {
            let info = body.asSlice();
            let op = info.loadUint(32);
            let messageId = info.loadUint(128);
            let a = info.loadUint(8);
            let minutes = info.loadUint(32);
            expect(op).toBe(Op.bridge.resend);
            expect(messageId).toBe(11111);
            expect(minutes).toBe(20)
        }
    });
    // it('swap failed expired', async () => {
    //     expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
    //     let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ6jHbA==";
    //     let dataFullBuffer = Buffer.from(dataFull, 'base64');
    //     let messageId = BigInt(11111);
    //     let sourceChainId = 9992731;
    //     let targetChainId = 1100;
    //     let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
    //     let receiver = bridge.address;
    //     let data = dataFullBuffer.slice(0, 96);
    //     let dataOther = dataFullBuffer.slice(96);
    //     let result = await bridge.sendTransmit(
    //         oracle.getSender(),
    //         toNano('0.01'),
    //         messageId,
    //         sourceChainId,
    //         targetChainId,
    //         sender,
    //         receiver,
    //         data,
    //         dataOther,
    //         swapId,
    //         jettonMinter.address
    //     );
    //     expect(result.transactions.length).toEqual(2);
    //     expect(result.transactions).toHaveTransaction({
    //         from: oracle.address,
    //         to: bridge.address,
    //         success: false,
    //     });
    //     let tx = findTransactionRequired(result.transactions, {
    //         on: bridge.address,
    //         from: oracle.address,
    //         op: Op.bridge.transmit,
    //         success: false
    //     });
    //     // let exitCode = tx
    //    
    //    
    // });
    it('swap failed already record', async () => {
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ6jHbA==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.01'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        messageId = BigInt(2222);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.01'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(result.transactions.length).toEqual(3);
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: false,
        });
    });
    it('release failed liquidity not enough and after add liquidity success', async () => {
        console.log(testAccount.address);
        console.log(bridgePool.address);
        console.log(bridge.address);
        console.log(oracle.address);

        const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        let user_liq = blockchain.openContract(
            BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
        let liquidity = await user_liq.getLiquidity();
        expect(liquidity.owner).toEqualAddress(testAccount.address);
        expect(liquidity.bridgePoolAddress).toEqualAddress(bridgePool.address);
        expect(liquidity.jettonAddress).toEqualAddress(jettonMinter.address);
        expect(liquidity.liquidity).toBe(toNano('100'));
        let remove_result = await user_liq.sendRemoveLiquidity(
            testAccount.getSender(),
            toNano('0.1'),
            toNano('100'),
            true
        );
        expect(remove_result.transactions).toHaveTransaction({
            from: testAccount.address,
            to: userLiquidityAddress,
            success: true,
        });
        expect(remove_result.transactions).toHaveTransaction({
            from: userLiquidityAddress,
            to: bridgePool.address,
            success: true,
        });
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ8J2Nw==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        for (let i = 0; i < result.transactions.length; i++) {
            console.log(result.transactions[i].inMessage?.info.src?.toString());
            console.log(result.transactions[i].inMessage?.info.dest?.toString());
        }
        // expect(result.transactions.length).toEqual(5);
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridge.address,
            success: true
        });

        const resend_tx = findTransactionRequired(result.transactions, {
            from: bridgePool.address,
            to: bridge.address,
            op: Op.bridge.resend_to_oracle,
            success: true,
        });
        send_transfer_gas_fee = printTxGasStats("resend", resend_tx);
        // gas used:14860 gas cost:3336400
        send_transfer_gas_fee = computeGasFee(gasPrices, 8341n);
        console.log(send_transfer_gas_fee);

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true
        });
        let body = result.transactions[2].outMessages.get(0)?.body;
        let receiptHash = BigInt(0);
        if (body != undefined) {
            let info = body.asSlice();
            let op = info.loadUint(32);
            let jetton = info.loadAddress();
            let message_info = info.loadRef();
            let m_slice = message_info.asSlice();
            let messageId = m_slice.loadInt(128);
            receiptHash = m_slice.loadUintBig(256);
            console.log(op);
            console.log(jetton);
            console.log(messageId);
            console.log(receiptHash);
        }
        let exist = await bridge.get_receipt_hash_exist(receiptHash, 1740797495);
        expect(exist).toBe(false);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 100000000000));
        let tx = findTransactionRequired(result.transactions, {
            from: bridge.address,
            to: oracle.address,
            success: true
        });
        let body1 = tx.outMessages.get(0)?.body;
        if (body1 != undefined) {
            let info = body1.asSlice();
            let op = info.loadUint(32);
            let messageId = info.loadUint(128);
            let a = info.loadUint(8);
            let minutes = info.loadUint(32);
            expect(op).toBe(Op.bridge.resend);
            expect(messageId).toBe(11111);
            expect(minutes).toBe(720)
        }
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('1');
        let payload = BridgePool.packAddLiquidityBody();
        const add_liquidity_res = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('2'),
            amount_add_liquidity,
            bridgePool.address,
            testAccount.address,
            null,
            forwardAmount,
            payload);

        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });

        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        let result1 = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(result1.transactions.length).toEqual(6);
        expect(result1.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result1.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });
        expect(result1.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });
        expect(result1.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });
        // check
        // 1. check account balance
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 1000000000));
        // 2. check pool liquidity
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 - 1000000000));
        // 3. check pool jetton wallet balance
        expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(100000000000 - 1000000000));
        // 4. check swap
        let swap = await bridgePool.getSwapData(chainId);
        expect(swap.swapId).toEqual(swapId.beginParse().loadUintBig(256));
        expect(swap.swappedAmount).toBe(BigInt(1000000000));
        expect(swap.swappedTimes).toBe(1n);
        exist = await bridge.get_receipt_hash_exist(receiptHash, 1740797495);
        expect(exist).toBe(true);
    });
    it('create receipt success pipeline fee', async () => {
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

        let receipt_amount = toNano('10');
        let forwardAmount = toNano('5');
        let payload = Bridge.PackCreateReceiptBody(
            chainId, accountJettonWallet.address,
            Buffer.from(targetAddressBuffer), jettonMinter.address);

        const result = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('10'),
            receipt_amount,
            bridge.address,
            testAccount.address,
            beginCell().storeUint(0, 1).endCell(),
            forwardAmount,
            payload);

        expect(result.transactions).toHaveTransaction({
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgeJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        const send_transfer_tx = findTransactionRequired(result.transactions, {
            from: testAccount.address,
            to: accountJettonWallet.address,
            op: Op.jetton.transfer,
            success: true,
        });
        send_transfer_gas_fee = printTxGasStats("transfer", send_transfer_tx);
        // gas used:8341 gas cost:3336400
        send_transfer_gas_fee = computeGasFee(gasPrices, 8341n);
        console.log(send_transfer_gas_fee);
        const send_account_internal_transfer_tx = findTransactionRequired(result.transactions, {
            from: accountJettonWallet.address,
            to: bridgeJettonWallet.address,
            op: Op.jetton.internal_transfer,
            success: true,
        });
        send_transfer_to_bridge_gas_fee = printTxGasStats("transfer to bridge", send_account_internal_transfer_tx);
        // gas used:10123 gas cost:4049200
        send_transfer_to_bridge_gas_fee = computeGasFee(gasPrices, 10123n);
        console.log(send_transfer_to_bridge_gas_fee);
        const send_transfer_notification_tx = findTransactionRequired(result.transactions, {
            from: bridgeJettonWallet.address,
            to: bridge.address,
            op: Op.jetton.transfer_notification,
            success: true,
        });
        send_notification_create_receipt_gas_fee = printTxGasStats("transfer notification create receipt ", send_transfer_notification_tx);
        // gas used:11130 gas cost:4452000
        send_notification_create_receipt_gas_fee = computeGasFee(gasPrices, 11130n);
        console.log(send_notification_create_receipt_gas_fee);
        const send_transfer_to_bridgePool_tx = findTransactionRequired(result.transactions, {
            from: bridge.address,
            to: bridgeJettonWallet.address,
            op: Op.jetton.transfer,
            success: true,
        });
        send_transfer_to_bridge_wallet_gas_fee = printTxGasStats("transfer to bridge wallet", send_transfer_to_bridgePool_tx);
        // gas used:8341 gas cost:3336400
        send_transfer_to_bridge_wallet_gas_fee = computeGasFee(gasPrices, 8341n);
        console.log(send_transfer_to_bridge_wallet_gas_fee);
        const send_internal_transfer_tx = findTransactionRequired(result.transactions, {
            from: bridgeJettonWallet.address,
            to: bridgePoolJettonWallet.address,
            op: Op.jetton.internal_transfer,
            success: true,
        });
        send_internal_transfer_to_bridge_pool_gas_fee = printTxGasStats("transfer to bridge pool", send_internal_transfer_tx);
        // gas used:10123 gas cost:4049200
        send_internal_transfer_to_bridge_pool_gas_fee = computeGasFee(gasPrices, 10123n);
        console.log(send_internal_transfer_to_bridge_pool_gas_fee);
        const send_transfer_notification_lock_tx = findTransactionRequired(result.transactions, {
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            op: Op.jetton.transfer_notification,
            success: true,
        });
        send_notification_lock_gas_fee = printTxGasStats("transfer notification lock", send_transfer_notification_lock_tx);
        // gas used:40853 gas cost:16341200
        send_notification_lock_gas_fee = computeGasFee(gasPrices, 40853n);
        console.log(send_notification_lock_gas_fee);
        const receipt_ok_tx = findTransactionRequired(result.transactions, {
            from: bridgePool.address,
            to: bridge.address,
            op: Op.bridge.receipt_ok,
            success: true,
        });
        send_receipt_ok_gas_fee = printTxGasStats("receipt ok", receipt_ok_tx);
        // gas used:19815 gas cost:7926000
        send_receipt_ok_gas_fee = computeGasFee(gasPrices, 19815n);
        console.log(send_receipt_ok_gas_fee);
        const sendToOracle = findTransactionRequired(result.transactions, {
            from: bridge.address,
            to: oracle.address,
            op: Op.bridge.send_bridge_info_to_oracle,
            success: true,
        });
        send_to_oracle_gas_fee = printTxGasStats("send to oracle", sendToOracle);
        // gas used:309 gas cost:123600
        send_to_oracle_gas_fee = computeGasFee(gasPrices, 309n);
        console.log(send_to_oracle_gas_fee);

    });
    it('swap success pipeline fee', async () => {
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYaggH66D60m+eWkBQ7RKhWfbRgOR68GMARenFK6nRFvOabRADxWDG+iSbBPsxzj0PxJlAh2fXLeF995kJdSm1kwZHyo0LkAAAAAZ7l9AA==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.02'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });
        // expect(result.transactions).toHaveTransaction({
        //     from: bridgePoolJettonWallet.address,
        //     to: accountJettonWallet.address,
        //     success: true
        // });

        const send_transmit_tx = findTransactionRequired(result.transactions, {
            from: oracle.address,
            to: bridge.address,
            op: Op.bridge.transmit,
            success: true
        });
        send_transmit_gas_fee = printTxGasStats("transmit", send_transmit_tx);
        // gas used:22031
        send_transmit_gas_fee = computeGasFee(gasPrices, 22031n);
        console.log(send_transmit_gas_fee);
        const send_release_tx = findTransactionRequired(result.transactions, {
            from: bridge.address,
            to: bridgePool.address,
            op: Op.bridge_pool.release,
            success: true
        });
        send_release_gas_fee = printTxGasStats("release", send_release_tx);
        // gas used:36689
        send_release_gas_fee = computeGasFee(gasPrices, 36689n);
        console.log(send_release_gas_fee);
        const send_transfer_tx = findTransactionRequired(result.transactions, {
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            op: Op.jetton.transfer,
            success: true
        });
        send_transfer_to_gas_fee = printTxGasStats("transfer", send_transfer_tx);
        // gas used:8341
        send_transfer_to_gas_fee = computeGasFee(gasPrices, 8341n);
        console.log(send_transfer_to_gas_fee);
        const send_transfer_to_account_tx = findTransactionRequired(result.transactions, {
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            op: Op.jetton.internal_transfer,
            success: true
        });
        send_transfer_to_account_gas_fee = printTxGasStats("transfer to account", send_transfer_to_account_tx);
        // gas used:7822
        send_transfer_to_account_gas_fee = computeGasFee(gasPrices, 7822n);
        console.log(send_transfer_to_account_gas_fee);
    });
    it("create native receipt success pipeline fee", async () => {
        let fee = await bridge.getEstimateCreateNativeFee();
        console.log(fee);
        let account_balance_before = await testAccount.getBalance();
        let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
        const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
        let receipt_amount = toNano('10');
        let res = await bridge.sendCreateNativeReceipt(testAccount.getSender(), toNano('10.5'), chainId, targetAddressBuffer, receipt_amount);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridgePoolTonCoin.address,
            to: bridge.address,
            success: true,
        });
        expect(res.transactions).toHaveTransaction({
            from: bridge.address,
            to: oracle.address,
            success: true,
        });
        const send_create_native_receipt_tx = findTransactionRequired(res.transactions, {
            from: testAccount.address,
            to: bridge.address,
            op: Op.bridge.create_native_receipt,
            success: true
        });
        send_create_native_receipt_gas_fee = printTxGasStats("create native receipt", send_create_native_receipt_tx);
        // gas used: 6997
        send_create_native_receipt_gas_fee = computeGasFee(gasPrices, 6997n);
        console.log(send_create_native_receipt_gas_fee);
        const send_lock_native_token_tx = findTransactionRequired(res.transactions, {
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            op: Op.bridge_pool.lock_native_token,
            success: true
        });
        send_lock_native_token_gas_fee = printTxGasStats("lock native token", send_lock_native_token_tx);
        // gas used: 39787
        send_lock_native_token_gas_fee = computeGasFee(gasPrices, 39787n);
        console.log(send_lock_native_token_gas_fee);
    });
    it('swap native success fee', async () => {
        let account_balance_before = await testAccount.getBalance();
        let balanceBefore = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
        expect(balanceBefore).toBeGreaterThanOrEqual(toNano('20'));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ7ADzw==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.01'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapIdTonCoin,
            HOLEADDRESS
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolTonCoin.address,
            to: testAccount.address,
            success: true
        });
        const send_release_tx = findTransactionRequired(result.transactions, {
            from: bridge.address,
            to: bridgePoolTonCoin.address,
            op: Op.bridge_pool.release,
            success: true
        });
        send_release_gas_fee = printTxGasStats("release", send_release_tx);
        // gas used: 36233
        send_release_gas_fee = computeGasFee(gasPrices, 36233n);
        console.log(send_release_gas_fee);
        const send_transfer_tx = findTransactionRequired(result.transactions, {
            from: bridgePoolTonCoin.address,
            to: testAccount.address,
            success: true
        });
        send_transfer_to_gas_fee = printTxGasStats("transfer", send_transfer_tx);
        // gas used: 309
        send_transfer_to_gas_fee = computeGasFee(gasPrices, 309n);
        console.log(send_transfer_to_gas_fee);
    });
    it('add liquidity success pipeline fee', async () => {
        const liquidity_account = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        const smc = await blockchain.getContract(liquidity_account);
        if (smc.accountState === undefined)
            throw new Error("Can't access account state");
        if (smc.accountState.type !== "active")
            throw new Error("Wallet account is not active");
        if (smc.account.account === undefined || smc.account.account === null)
            throw new Error("Can't access wallet account!");
        console.log("liquidity account max storage stats:", smc.account.account.storageStats.used);
        const state = smc.accountState.state;
        const stateCell = beginCell().store(storeStateInit(state)).endCell();
        console.log("State init stats:", collectCellStats(stateCell, []));
        // add jetton liquidity
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('1');
        let payload = BridgePool.packAddLiquidityBody();
        const add_liquidity_res = await accountJettonWallet.sendTransfer(
            testAccount.getSender(),
            toNano('2'),
            amount_add_liquidity,
            bridgePool.address,
            testAccount.address,
            null,
            forwardAmount,
            payload);
        const add_liquidity_tx = findTransactionRequired(add_liquidity_res.transactions, {
            from: bridgePoolJettonWallet.address,
            to: bridgePool.address,
            op: Op.jetton.transfer_notification,
            success: true
        });
        add_liquidity_gas_fee = printTxGasStats("add liquidity", add_liquidity_tx);
        // gas used: 13736
        add_liquidity_gas_fee = computeGasFee(gasPrices, 13736n);
        console.log(add_liquidity_gas_fee);
        const provider_liquidity_tx = findTransactionRequired(add_liquidity_res.transactions, {
            from: bridgePool.address,
            to: liquidity_account,
            op: Op.bridge_pool.provider_liquidity,
            success: true
        });
        provider_liquidity_gas_fee = printTxGasStats("provider liquidity", provider_liquidity_tx);
        // gas used: 3412
        provider_liquidity_gas_fee = computeGasFee(gasPrices, 3412n);
        console.log(provider_liquidity_gas_fee);
    });
    it('add native liquidity success pipeline fee', async () => {
        const liquidity_account = await bridgePoolTonCoin.getPoolLiquidityAccountAddress(testAccount.address);
        const smc = await blockchain.getContract(liquidity_account);
        if (smc.accountState === undefined)
            throw new Error("Can't access account state");
        if (smc.accountState.type !== "active")
            throw new Error("Wallet account is not active");
        if (smc.account.account === undefined || smc.account.account === null)
            throw new Error("Can't access wallet account!");
        console.log("liquidity account max storage stats:", smc.account.account.storageStats.used);
        const state = smc.accountState.state;
        const stateCell = beginCell().store(storeStateInit(state)).endCell();
        console.log("State init stats:", collectCellStats(stateCell, []));
        let resAddLiquidity = await bridgePoolTonCoin.sendAddNativeLiquidity(testAccount.getSender(), toNano('21'), toNano('20'));
        const add_liquidity_tx = findTransactionRequired(resAddLiquidity.transactions, {
            to: bridgePoolTonCoin.address,
            op: Op.bridge_pool.add_native_token_liquidity,
            success: true
        });
        add_liquidity_gas_fee = printTxGasStats("add liquidity", add_liquidity_tx);
        // gas used: 13807
        add_liquidity_gas_fee = computeGasFee(gasPrices, 13807n);
        console.log(add_liquidity_gas_fee);
        const provider_liquidity_tx = findTransactionRequired(resAddLiquidity.transactions, {
            from: bridgePoolTonCoin.address,
            to: liquidity_account,
            op: Op.bridge_pool.provider_liquidity,
            success: true
        });
        provider_liquidity_gas_fee = printTxGasStats("provider liquidity", provider_liquidity_tx);
        // gas used: 3412
        provider_liquidity_gas_fee = computeGasFee(gasPrices, 3412n);
        console.log(provider_liquidity_gas_fee);
    });
    it('remove liquidity success pipeline fee', async () => {
        const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        let user_liq = blockchain.openContract(
            BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
        let remove_result = await user_liq.sendRemoveLiquidity(
            testAccount.getSender(),
            toNano('0.1'),
            toNano('100'),
            true
        );
        const user_remove_liquidity_tx = findTransactionRequired(remove_result.transactions, {
            from: testAccount.address,
            to: userLiquidityAddress,
            success: true
        });
        user_remove_liquidity_gas_fee = printTxGasStats("remove liquidity", user_remove_liquidity_tx);
        // gas used: 6026
        user_remove_liquidity_gas_fee = computeGasFee(gasPrices, 6026n);
        console.log(user_remove_liquidity_gas_fee);
        const remove_liquidity_tx = findTransactionRequired(remove_result.transactions, {
            from: userLiquidityAddress,
            to: bridgePool.address,
            op: Op.bridge_pool.remove_liquidity,
            success: true
        });
        remove_liquidity_gas_fee = printTxGasStats("remove liquidity", remove_liquidity_tx);
        // gas used: 14626
        remove_liquidity_gas_fee = computeGasFee(gasPrices, 14626n);
        console.log(remove_liquidity_gas_fee);
    });
    it('remove native liquidity success pipeline fee', async () => {
        const userLiquidityAddress = await bridgePoolTonCoin.getPoolLiquidityAccountAddress(testAccount.address);
        let user_liq = blockchain.openContract(
            BridgePoolLiquidityAccount.createFromAddress(userLiquidityAddress));
        let remove_result = await user_liq.sendRemoveLiquidity(
            testAccount.getSender(),
            toNano('0.1'),
            toNano('10'),
            true
        );
        const user_remove_liquidity_tx = findTransactionRequired(remove_result.transactions, {
            from: testAccount.address,
            to: userLiquidityAddress,
            success: true
        });
        user_remove_liquidity_gas_fee = printTxGasStats("remove liquidity", user_remove_liquidity_tx);
        // gas used: 6026
        user_remove_liquidity_gas_fee = computeGasFee(gasPrices, 6026n);
        console.log(user_remove_liquidity_gas_fee);
        const remove_liquidity_tx = findTransactionRequired(remove_result.transactions, {
            from: userLiquidityAddress,
            to: bridgePoolTonCoin.address,
            op: Op.bridge_pool.remove_liquidity,
            success: true
        });
        remove_liquidity_gas_fee = printTxGasStats("remove liquidity", remove_liquidity_tx);
        // gas used: 14898
        remove_liquidity_gas_fee = computeGasFee(gasPrices, 14626n);
        console.log(remove_liquidity_gas_fee);
        const transfer_tx = findTransactionRequired(remove_result.transactions, {
            from: bridgePoolTonCoin.address,
            to: testAccount.address,
            success: true
        });
        send_transfer_gas_fee = printTxGasStats("transfer", transfer_tx);
        // gas used: 309
        send_transfer_gas_fee = computeGasFee(gasPrices, 309n);
        console.log(send_transfer_gas_fee);
    });
    it('create receipt fee', async () => {
        const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        // const smc = await blockchain.getContract(userLiquidityAddress);
        // if (smc.accountState === undefined)
        //     throw new Error("Can't access wallet account state");
        // if (smc.accountState.type !== "active")
        //     throw new Error("Wallet account is not active");
        // if (smc.account.account === undefined || smc.account.account === null)
        //     throw new Error("Can't access wallet account!");
        // console.log("bridge liquidity storage stats:", smc.account.account.storageStats.used);
        // const state = smc.accountState.state;
        // const stateCell = beginCell().store(storeStateInit(state)).endCell();
        // console.log("State init stats:", collectCellStats(stateCell, []));

        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgePool.address);
        console.log(bridgePoolJettonWallet.address);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ6jHbA==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.01'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );

        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });

        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });

        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });

        const send_transmit_tx = findTransactionRequired(result.transactions, {
            on: bridge.address,
            from: oracle.address,
            op: Op.bridge.transmit,
            success: true
        });
        send_transmit_gas_fee = printTxGasStats("transmit", send_transmit_tx);
        // gas used:17650
        send_transmit_gas_fee = computeGasFee(gasPrices, 17650n);
        console.log(send_transmit_gas_fee);

        // const send_swap_tx = findTransactionRequired(result.transactions, {
        //     on: bridgeSwap.address,
        //     from: bridge.address,
        //     op: Op.bridge_swap.swap,
        //     success: true
        // });
        // send_swap_gas_fee = printTxGasStats("swap", send_swap_tx);
        // // gas used:12558
        // send_swap_gas_fee = computeGasFee(gasPrices, 12558n);
        // console.log(send_swap_gas_fee);
        // const swapInMessage = send_swap_tx.inMessage!
        // let swapMessageStats = computeMessageForwardFees(msgPrices, swapInMessage).stats;
        // console.log(swapMessageStats);
        //
        const send_release_tx = findTransactionRequired(result.transactions, {
            on: bridgePool.address,
            from: bridge.address,
            op: Op.bridge_pool.release,
            success: true
        });
        send_release_gas_fee = printTxGasStats("release", send_release_tx);
        // gas used:34096
        send_release_gas_fee = computeGasFee(gasPrices, 34096n);
        console.log(send_release_gas_fee);
        const releaseInMessage = send_release_tx.inMessage!
        let releaseMessageStats = computeMessageForwardFees(msgPrices, releaseInMessage).stats;
        console.log(releaseMessageStats);

        const send_transfer_tx = findTransactionRequired(result.transactions, {
            on: bridgePoolJettonWallet.address,
            from: bridgePool.address,
            op: Op.jetton.transfer,
            success: true
        });
        send_transfer_to_gas_fee = printTxGasStats("transfer", send_transfer_tx);
        // gas used:8341
        send_transfer_to_gas_fee = computeGasFee(gasPrices, 8341n);
        console.log(send_transfer_to_gas_fee);
        const transferInMessage = send_transfer_tx.inMessage!
        let transferMessageStats = computeMessageForwardFees(msgPrices, transferInMessage).stats;
        console.log(transferMessageStats);

        const receive_tx = findTransactionRequired(result.transactions, {
            on: accountJettonWallet.address,
            from: bridgePoolJettonWallet.address,
            op: Op.jetton.internal_transfer,
            success: true
        });
        send_receive_gas_fee = printTxGasStats("receive", receive_tx);
        // gas used:7822
        send_receive_gas_fee = computeGasFee(gasPrices, 7822n);
        console.log(send_receive_gas_fee);
        const receiveInMessage = receive_tx.inMessage!
        let receiveMessageStats = computeMessageForwardFees(msgPrices, receiveInMessage).stats;
        console.log(receiveMessageStats);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 1000000000));
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 - 1000000000));
        expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(100000000000 - 1000000000));

    });
    it('swap fee', async () => {
        const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        // const smc = await blockchain.getContract(userLiquidityAddress);
        // if (smc.accountState === undefined)
        //     throw new Error("Can't access wallet account state");
        // if (smc.accountState.type !== "active")
        //     throw new Error("Wallet account is not active");
        // if (smc.account.account === undefined || smc.account.account === null)
        //     throw new Error("Can't access wallet account!");
        // console.log("bridge liquidity storage stats:", smc.account.account.storageStats.used);
        // const state = smc.accountState.state;
        // const stateCell = beginCell().store(storeStateInit(state)).endCell();
        // console.log("State init stats:", collectCellStats(stateCell, []));

        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgePool.address);
        console.log(bridgePoolJettonWallet.address);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ73lwg==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );

        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });

        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });

        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });

        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });

        const send_transmit_tx = findTransactionRequired(result.transactions, {
            on: bridge.address,
            from: oracle.address,
            op: Op.bridge.transmit,
            success: true
        });
        send_transmit_gas_fee = printTxGasStats("transmit", send_transmit_tx);
        // gas used:17650
        send_transmit_gas_fee = computeGasFee(gasPrices, 17650n);
        console.log(send_transmit_gas_fee);

        //
        const send_release_tx = findTransactionRequired(result.transactions, {
            on: bridgePool.address,
            from: bridge.address,
            op: Op.bridge_pool.release,
            success: true
        });
        send_release_gas_fee = printTxGasStats("release", send_release_tx);
        // gas used:36815
        send_release_gas_fee = computeGasFee(gasPrices, 36815n);
        console.log(send_release_gas_fee);
        const releaseInMessage = send_release_tx.inMessage!
        let releaseMessageStats = computeMessageForwardFees(msgPrices, releaseInMessage).stats;
        console.log(releaseMessageStats);

        const send_transfer_tx = findTransactionRequired(result.transactions, {
            on: bridgePoolJettonWallet.address,
            from: bridgePool.address,
            op: Op.jetton.transfer,
            success: true
        });
        send_transfer_to_gas_fee = printTxGasStats("transfer", send_transfer_tx);
        // gas used:8341
        send_transfer_to_gas_fee = computeGasFee(gasPrices, 8341n);
        console.log(send_transfer_to_gas_fee);
        const transferInMessage = send_transfer_tx.inMessage!
        let transferMessageStats = computeMessageForwardFees(msgPrices, transferInMessage).stats;
        console.log(transferMessageStats);

        const receive_tx = findTransactionRequired(result.transactions, {
            on: accountJettonWallet.address,
            from: bridgePoolJettonWallet.address,
            op: Op.jetton.internal_transfer,
            success: true
        });
        send_receive_gas_fee = printTxGasStats("receive", receive_tx);
        // gas used:7822
        send_receive_gas_fee = computeGasFee(gasPrices, 7822n);
        console.log(send_receive_gas_fee);
        const receiveInMessage = receive_tx.inMessage!
        let receiveMessageStats = computeMessageForwardFees(msgPrices, receiveInMessage).stats;
        console.log(receiveMessageStats);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 1000000000));
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 - 1000000000));
        expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(100000000000 - 1000000000));

    });

    it('cleanup receiptHash test', async () => {
        let receiptHash = 58119951496274937510333063170106550521839217294265447462353709256896406305190n;
        let timestamp = 1740362400;
        let res = await bridge.sendRecordReceiptHash(testAccount.getSender(), toNano('0.01'), timestamp, receiptHash);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        let body0 = res.transactions[1]?.outMessages?.get(0)?.body;
        if (body0 !== undefined) {
            let c = body0.asSlice();
            console.log(c);
        }
        let exist = await bridge.get_receipt_hash_exist(receiptHash, timestamp);
        expect(exist).toBe(true);
        let receiptHash1 = 58119962496274937510443063170106550521839217294265447462353709256896406305190n;
        let res1 = await bridge.sendRecordReceiptHash(testAccount.getSender(), toNano('0.01'), timestamp, receiptHash1);
        expect(res1.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        let exist1 = await bridge.get_receipt_hash_exist(receiptHash1, timestamp);
        expect(exist1).toBe(true);
        let receiptHash2 = 58119962496274937510443063133106550521839217294265447462353709256896406305190n;
        let res2 = await bridge.sendRecordReceiptHash(testAccount.getSender(), toNano('0.01'), timestamp, receiptHash2);
        expect(res2.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        let exist2 = await bridge.get_receipt_hash_exist(receiptHash2, timestamp);
        expect(exist2).toBe(true);

        let receiptHash3 = 58119962496274937510443063133106550521839217294265447462353711256896406305190n;
        let res3 = await bridge.sendRecordReceiptHash(testAccount.getSender(), toNano('0.01'), timestamp, receiptHash3);
        expect(res3.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        let exist3 = await bridge.get_receipt_hash_exist(receiptHash3, timestamp);
        expect(exist3).toBe(true);

        let receiptHash4 = 58119951496274937510333063170106550521839217294215637462353709256896406305190n;
        let res4 = await bridge.sendRecordReceiptHash(testAccount.getSender(), toNano('0.01'), timestamp, receiptHash4);
        expect(res4.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        let exist4 = await bridge.get_receipt_hash_exist(receiptHash, timestamp);
        expect(exist4).toBe(true);
        let receiptHash5 = 58119951496274917510333063170106550521839217294265447132353709256896406305190n;
        let res5 = await bridge.sendRecordReceiptHash(testAccount.getSender(), toNano('0.01'), timestamp, receiptHash5);
        expect(res5.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridge.address,
            success: true,
        });
        let exist5 = await bridge.get_receipt_hash_exist(receiptHash4, timestamp);
        expect(exist5).toBe(true);

        let body1 = res5.transactions[1]?.outMessages?.get(0)?.body;
        if (body1 !== undefined) {
            let c = body1.asSlice();
            console.log(c);
        }
        
        
        // let receiptHash6 = 58119951496274917510333063170106550521839217294265447132353709253336406305190n;
        // let clear_res = await bridge.sendCleanReceiptHash(testAccount.getSender(), toNano('0.1'), 1740797495, receiptHash6);
        // expect(clear_res.transactions).toHaveTransaction({
        //     from: testAccount.address,
        //     to: bridge.address,
        //     success: true,
        // });
        // let body = clear_res.transactions[1]?.outMessages?.get(0)?.body;
        // if (body !== undefined) {
        //     let c = body.asSlice();
        //     let time = c.loadUint(64);
        //     let now = c.loadUint(64);
        //     let hash = c.loadUintBig(256);
        //     console.log(time);
        //     console.log(now);
        //     console.log(hash);
        // }
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAARZumaYhqYvjEujTCabv7BPasf/W7hyDBYWDqmrkBBckRAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJMAAAAAZ8J2Nw==";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1100;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.05'),
            messageId,
            sourceChainId,
            targetChainId,
            sender,
            receiver,
            data,
            dataOther,
            swapId,
            jettonMinter.address
        );
        expect(result.transactions).toHaveTransaction({
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        let tx = findTransactionRequired(result.transactions, {
            from: oracle.address,
            to: bridge.address,
            success: true,
        });
        expect(result.transactions).toHaveTransaction({
            from: bridge.address,
            to: bridgePool.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: bridgePoolJettonWallet.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });
        exist = await bridge.get_receipt_hash_exist(receiptHash, timestamp);
        console.log(exist);
        expect(exist).toBe(false);
        exist1 = await bridge.get_receipt_hash_exist(receiptHash1, timestamp);
        console.log(exist1);
        expect(exist1).toBe(false);
        exist2 = await bridge.get_receipt_hash_exist(receiptHash2, timestamp);
        console.log(exist2);
        expect(exist2).toBe(false);
        exist3 = await bridge.get_receipt_hash_exist(receiptHash3, timestamp);
        console.log(exist3);
        expect(exist3).toBe(false);
        exist4 = await bridge.get_receipt_hash_exist(receiptHash4, timestamp);
        console.log(exist4);
        expect(exist4).toBe(false);
        exist5 = await bridge.get_receipt_hash_exist(receiptHash5, timestamp);
        console.log(exist5);
        expect(exist5).toBe(false);
        
    })

    it('decode send to oracle message', async () => {
        let body = "te6cckECBgEAAUwAA1sAAAAAAAAAUwAdepiAGlzrrbnRhbtjrjkQHBTBLC1n1gN7cqftbwDFiKmrEwhQBAECAcYDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCmLS0c32SE1X0eIDgAnWYMoYqPWFLs+NeW6eGHKV4vQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEXAAEDAkgAHXqYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARFwAEBQCGAgA7GZ8UsWmJ/THf6UQzoc2aeiRAOGGGcSW7YmtMkzH+HtJOgGAS9EbYtDvoSIPlV+LR7pHyNPkwROec/ts6r0TxAABAlfa/uRxI7mZ+L8lx472Z5Qg7Pp3kMA/olIVgnJVMsRoAQ4AKRSlvsm2g2fiNQ3euMtFU+bgo9uhjq0Gqk6zmSnK7/pArtk06";
        let c = Cell.fromBase64(body);
        let sli = c.asSlice();
        let op = sli.loadUint(32);
        let targetChainId = sli.loadUint(32);
        let targetContractRef = sli.loadRef();
        let targetContractSlice = targetContractRef.asSlice();
        let targetContractAddress = targetContractSlice.loadBuffer(32);
        console.log(aelf.utils.base58.encode(targetContractAddress));
        let messageRef = sli.loadRef();
        let messageSlice = messageRef.asSlice();
        console.log(messageSlice);
        let config = sli.loadRef();
        let configSlice = config.asSlice();
        let chainId = configSlice.loadUint(32);
        console.log(chainId);
        let contractRef = configSlice.loadRef();
        let contractSlice = contractRef.asSlice();
        let contractAddress = contractSlice.loadBuffer(32);
        console.log(aelf.utils.base58.encode(contractAddress));
        let data = configSlice.loadRef();
        let dataSlice = data.asSlice();
        let jettonAddress = dataSlice.loadAddress();
        console.log(jettonAddress);
        let amount = configSlice.loadUintBig(256);
        console.log(amount);
    });
    it('decode from oracle message', async () => {
        let body = "te6cckECCwEAAcoAASgAAAAD30lSNKFoTxV0uA4KWmFVlwEEEAAdepgAAARMAgMEBQBAlfa/uRxI7mZ+L8lx472Z5Qg7Pp3kMA/olIVgnJVMsRoAQ4AaXOutudGFu2OuORAcFMEsLWfWA3typ+1vAMWIqasTCFABxgMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACrF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACHojAQYESAAABEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcICQoAngJgB4X6GMGwvZXzZ88IXosZ4yb7NGZ8IBYNL5N9gPZh6tTRADSU4zAnVSelzdw4u+odrPtZhiG30w9x4AXPiqGmTz1LF6QAAAAAZ76NmAAAQOmpCfljTf+7mAB9mBx423NdXY2hJMc6VjyPYCv43Q57AGBFUURTNTExdHpvd3QyeDF4eUlEZ3BnbGhhejZ3Rzl1VlAydDRCaXhGVFZpWVFqaTEAQ4AKRSlvsm2g2fiNQ3euMtFU+bgo9uhjq0Gqk6zmSnK7/pAACFVTRFSAfzGB";
        let c = Cell.fromBase64(body);
        let sli = c.asSlice();
        let op = sli.loadUint(32);
        let messageId = sli.loadUintBig(128);
        console.log(messageId);
        let originData = sli.loadRef();
        let originDataSlice = originData.asSlice();
        let chainId = originDataSlice.loadUint(32);
        let targetChainId = originDataSlice.loadUint(32);
        console.log(chainId);
        console.log(targetChainId);
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
        let receiptHash = data1.slice(0, 32);
        const hexString = receiptHash.toString('hex');
        const receiptHashInt = BigInt('0x' + hexString);
        console.log(receiptHashInt);

        let convertInfo = originDataSlice.loadRef();
        let infoSlice = convertInfo.asSlice();
        let swapId = infoSlice.loadRef();
        let swapIdSlice = swapId.asSlice();
        let swapId1 = swapIdSlice.loadBuffer(32);
        console.log(swapId1.toString('base64'));

        let chainId1 = infoSlice.loadUint(32);
        let target = infoSlice.loadRef();
        let jettonAddress = infoSlice.loadRef().beginParse().loadAddress();
        let originToken = infoSlice.loadRef();
        console.log(chainId1);
        console.log(jettonAddress);

    });
    it('decode resend to oracle message', async () => {
        let body = "te6cckEBAgEAZwABYx9VvS6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL4AAAAAAAFRgQAQBgR9hPurPHLj2yb/gAbIPEFAS2IdQeDxBGq4Twq99s2HvZlOcL9D4z+SK4qKnoE2eq7kRM/Q==";
        let c = Cell.fromBase64(body);
        let sli = c.asSlice();
        let op = sli.loadUint(32);
        let jetton = sli.loadAddress();
        console.log(jetton);
        let message = sli.loadRef();
        let messageSlice = message.asSlice();
        let messageId = messageSlice.loadIntBig(128);
        console.log(messageId);
        let receiptHash = messageSlice.loadUintBig(256);
        console.log(receiptHash);
        let exitCode = sli.loadUint(32);
        console.log(exitCode);
        let timespan = sli.loadUint(64);
        console.log(timespan);
    })
    it('decode release message', async () => {
        let body = "te6cckEBBAEAxAACLZ5HAx18gVURX1z0/R5m92K3Y4olInEIAQIAQA2Jkt5oaEMqHjkvaCeQFbeMvbEGAOJJ+2Nj+BwLhybNAYN3/i5SqfjElu7AHaXo+gzMWlJaNSLk36Iqdt0UUSaqUIAGkpxmBOqk9Lm7hxd9Q7WfazDENvph7jwAufFUNMnnqXADAIDNbr0R3Uo+K0rhnPKhHO8xHkNBehaXbG7bzuDz9TUFtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGvWh1yg==";
        let c = Cell.fromBase64(body);
        let slice = c.asSlice();
        let op = slice.loadUint(32);
        let messageId = slice.loadIntBig(128);
        console.log(messageId);
        let swapId = slice.loadRef();
        let swapIdSlice = swapId.asSlice();
        let swapId1 = swapIdSlice.loadUintBig(256);
        console.log(swapId1);
        let hex = swapId1.toString(16);
        if (hex.length % 2) hex = '0' + hex;
        const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
        let swapId2 = Buffer.from(bytes).toString('base64');
        console.log(swapId2);
        let receipt_cell = slice.loadRef();
        let amount = slice.loadCoins();
        console.log(amount);
    })
    it('decode swap created event', async () => {
        let body = "te6cckEBBQEAWgACCP6N3GoBAgEIAB16mAMBCACYehsEAEANiZLeaGhDKh45L2gnkBW3jL2xBgDiSftjY/gcC4cmzQBAkvmWDid+D2vNn3PLaskC5YU32NlkO63rMlIp9uKymGBdBBHM";
        let c = Cell.fromBase64(body);
        let slice = c.asSlice();
        let op = slice.loadUint(32);
        let swapSide = slice.loadRef();
        let swapIdSlide = swapSide.asSlice();
        let chainId = swapIdSlide.loadUint(32);
        console.log(chainId);
        let swapIdRef = swapIdSlide.loadRef();
        let swapIdRefSlice = swapIdRef.asSlice();
        let swapIdHash = swapIdRefSlice.loadUintBig(256);
        console.log(swapIdHash);

        let swapMain = slice.loadRef();
        let swapMainSlice = swapMain.asSlice();
        let chainIdMain = swapMainSlice.loadUint(32);
        console.log(chainIdMain);
        let swapIdMain = swapMainSlice.loadRef();
        let swapIdMainSlice = swapIdMain.asSlice();
        let swapIdMainHash = swapIdMainSlice.loadUintBig(256);
        console.log(swapIdMainHash);
        let hex = swapIdMainHash.toString(16);
        if (hex.length % 2) hex = '0' + hex;
        const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
        let swapId = Buffer.from(bytes).toString('base64');
        console.log(swapId);
    })
    it('decode released event', async () => {
        let body = "te6cckEBAgEAlAABnT12/VqAB4rBjfRJNgn2Y5x6H4kygQ7PrlvC++8yEupTayYMj5UQAUilLfZNtBs/Eahu9cZaKp83BR7dDHVoNVJ1nMlOV3/Qw9CQAAdepiABAIDF5/K4GjLOg14Et/LLW6x9A1RBirnxZRY2LETiwiQtawAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiGe7S1g==";
        let c = Cell.fromBase64(body);
        let slice = c.asSlice();
        let eventId = slice.loadUint(32);
        console.log(eventId);
        let receiver = slice.loadAddress();
        console.log(receiver);
        let jettonAddress = slice.loadAddress();
        console.log(jettonAddress);
        let amount = slice.loadCoins();
        console.log(amount);
        let fromChainId = slice.loadUint(32);
        console.log(fromChainId);
        let receiptId = slice.loadRef();
        let receiptIdSlice = receiptId.asSlice();
        let receiptHash = receiptIdSlice.loadUintBig(256);
        let index = receiptIdSlice.loadUintBig(256);
        console.log(receiptHash);
        console.log(index);
    })
    // it('fee', async () => {
    //     // let fee = await bridge.getEstimateCreateReceiptFee();
    //     // console.log(fee);
    //     // let fee1 = await bridge.getEstimateRecordReceiptFee();
    //     // console.log(fee1);
    //     // let fee2 = await bridge.getEstimateSwapFee();
    //     // console.log(fee2);
    //     // let fee3 = await bridge.getEstimateRecordSwapFee();
    //     // console.log(fee3);
    //     // let fee4 = await bridge.getEstimateStorageFee();
    //     // console.log(fee4);
    //     // let fee5 = await bridge.getEstimateLockFee();
    //     // console.log(fee5);
    // });
    // it("bridge max storage", async () => {
    //     const res1 = await bridge.sendAddJetton(
    //         admin.getSender(),
    //         toNano('0.5'), [deployer, ...await blockchain.createWallets(20)].map(s => s.address), chainId);
    //     expect(res1.transactions).toHaveTransaction({
    //         from: admin.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     const res11 = await bridge.sendAddJetton(
    //         admin.getSender(),
    //         toNano('0.5'), [deployer, ...await blockchain.createWallets(20)].map(s => s.address), 1173);
    //     expect(res11.transactions).toHaveTransaction({
    //         from: admin.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     // 2. set bridge swap
    //     let randomWallet1 = (await blockchain.createWallets(20)).map(s => s.address);
    //     let randomWallet2 = (await blockchain.createWallets(20)).map(s => s.address);
    //     const input = randomWallet1.map((address1, index) => ({
    //         jetton_address: address1,
    //         contract_address: randomWallet2[index] || ''
    //     }));
    //     const res2 = await bridge.sendSetBridgeSwap(admin.getSender(), toNano('0.5'), input);
    //     expect(res2.transactions).toHaveTransaction({
    //         from: admin.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     // 3. set bridge pool
    //     const res3 = await bridge.sendSetBridgePool(
    //         admin.getSender(), toNano('0.5'),
    //         input);
    //     expect(res3.transactions).toHaveTransaction({
    //         from: admin.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //
    //     const smc = await blockchain.getContract(bridge.address);
    //     if (smc.accountState === undefined)
    //         throw new Error("Can't access wallet account state");
    //     if (smc.accountState.type !== "active")
    //         throw new Error("Wallet account is not active");
    //     if (smc.account.account === undefined || smc.account.account === null)
    //         throw new Error("Can't access wallet account!");
    //     console.log("bridge max storage stats:", smc.account.account.storageStats.used);
    //     const state = smc.accountState.state;
    //     const stateCell = beginCell().store(storeStateInit(state)).endCell();
    //     console.log("State init stats:", collectCellStats(stateCell, []));
    // });
    //
    // it("bridge pool max storage", async () => {
    //     const smc = await blockchain.getContract(bridgePool.address);
    //     if (smc.accountState === undefined)
    //         throw new Error("Can't access wallet account state");
    //     if (smc.accountState.type !== "active")
    //         throw new Error("Wallet account is not active");
    //     if (smc.account.account === undefined || smc.account.account === null)
    //         throw new Error("Can't access wallet account!");
    //     console.log("bridge pool max storage stats:", smc.account.account.storageStats.used);
    //     const state = smc.accountState.state;
    //     const stateCell = beginCell().store(storeStateInit(state)).endCell();
    //     console.log("State init stats:", collectCellStats(stateCell, []));
    // });

    // it("bridge swap max storage", async () => {
    //     const result = await bridgeSwap.sendCreateSwap(
    //         admin.getSender(), toNano('0.5'), [{
    //             fromChainId: 1133,
    //             originShare: 1000,
    //             targetShare: 1
    //         }]);
    //
    //     expect(result.transactions).toHaveTransaction({
    //         from: admin.address,
    //         to: bridgeSwap.address,
    //         success: true,
    //     });
    //     const smc = await blockchain.getContract(bridgeSwap.address);
    //     if (smc.accountState === undefined)
    //         throw new Error("Can't access wallet account state");
    //     if (smc.accountState.type !== "active")
    //         throw new Error("Wallet account is not active");
    //     if (smc.account.account === undefined || smc.account.account === null)
    //         throw new Error("Can't access wallet account!");
    //     console.log("bridge swap max storage stats:", smc.account.account.storageStats.used);
    //     const state = smc.accountState.state;
    //     const stateCell = beginCell().store(storeStateInit(state)).endCell();
    //     console.log("State init stats:", collectCellStats(stateCell, []));
    // });

    // it("create native receipt", async () => {
    //     let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
    //     const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);
    //     let receipt_amount = toNano('10');
    //     let res = await bridge.sendCreateNativeReceipt(testAccount.getSender(), toNano('10.5'), chainId, targetAddressBuffer, receipt_amount);
    //     expect(res.transactions).toHaveTransaction({
    //         from: testAccount.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     expect(res.transactions).toHaveTransaction({
    //         from: bridge.address,
    //         to: bridgePoolTonCoin.address,
    //         success: true,
    //     });
    //     expect(res.transactions).toHaveTransaction({
    //         from: bridgePoolTonCoin.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     expect(res.transactions).toHaveTransaction({
    //         from: bridge.address,
    //         to: oracle.address,
    //         success: true,
    //     });
    //
    //     // const createReceiptTx = findTransactionRequired(res.transactions, {
    //     //     on: bridge.address,
    //     //     from: testAccount.address,
    //     //     op: Op.bridge.create_native_receipt,
    //     //     success: true
    //     // });
    //     // send_notification_create_receipt_gas_fee = printTxGasStats("create receipt", createReceiptTx);
    //     // // gas used:8055
    //     // send_notification_create_receipt_gas_fee = computeGasFee(gasPrices, 8055n);
    //     // console.log(send_notification_create_receipt_gas_fee);
    //     // let stat1 = computeMessageForwardFees(msgPrices, createReceiptTx.inMessage!).stats;
    //     // console.log(stat1);
    //     //
    //     // const lockTx = findTransactionRequired(res.transactions, {
    //     //     on: bridgePoolTonCoin.address,
    //     //     from: bridge.address,
    //     //     op: Op.bridge.lock_native_token,
    //     //     success: true
    //     // });
    //     // send_notification_lock_gas_fee = printTxGasStats("lock", lockTx);
    //     // // gas used:35443
    //     // send_notification_lock_gas_fee = computeGasFee(gasPrices, 35443n);
    //     // console.log(send_notification_lock_gas_fee);
    //     // let stat2 = computeMessageForwardFees(msgPrices, lockTx.inMessage!).stats;
    //     // console.log(stat2);
    //     //
    //     // const recordReceiptTx = findTransactionRequired(res.transactions, {
    //     //     on: receiptAccountAddress,
    //     //     from: bridgePoolTonCoin.address,
    //     //     op: Op.bridge_pool.record_receipt,
    //     //     success: true
    //     // });
    //     // send_record_receipt_gas_fee = printTxGasStats("record receipt", recordReceiptTx);
    //     // // gas used:9969
    //     // send_record_receipt_gas_fee = computeGasFee(gasPrices, 9969n);
    //     // console.log(send_record_receipt_gas_fee);
    //     // let stat3 = computeMessageForwardFees(msgPrices, recordReceiptTx.inMessage!).stats;
    //     // console.log(stat3);
    //     //
    //     // const receiptOkTx = findTransactionRequired(res.transactions, {
    //     //     on: bridge.address,
    //     //     from: receiptAccountAddress,
    //     //     op: Op.bridge.receipt_ok,
    //     //     success: true
    //     // });
    //     // send_receipt_ok_gas_fee = printTxGasStats("receipt ok", receiptOkTx);
    //     // // gas used:22652
    //     // send_receipt_ok_gas_fee = computeGasFee(gasPrices, 22652n);
    //     // console.log(send_receipt_ok_gas_fee);
    //     // let stat4 = computeMessageForwardFees(msgPrices, receiptOkTx.inMessage!).stats;
    //     // console.log(stat4);
    //
    //     let liquidityAfter = await bridgePoolTonCoin.getPoolLiquidity();
    //     expect(liquidityAfter).toBe(toNano('30'));
    //
    //     let bridgeBalance = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
    //     expect(bridgeBalance).toBeGreaterThanOrEqual(toNano('30'));
    //
    //     const res3 = await bridgePoolTonCoin.getReceiptDailyLimit(chainId);
    //     expect(res3.remainToken).toBe(BigInt(10000000000000000 - 10000000000));
    //     console.log(res3.refreshTime);
    //     expect(res3.dailyLimit).toBe(BigInt(10000000000000000));
    //
    //     const res4 = await bridgePoolTonCoin.getReceiptRateLimit(chainId);
    //     expect(res4.currentTokenAmount).toBeGreaterThanOrEqual(BigInt(1000000000000000 - 10000000000));
    //     expect(res4.tokenCapacity).toBe(BigInt(1000000000000000));
    //     expect(res4.rate).toBe(BigInt(1000000000));
    //     expect(res4.isEnable).toBe(true);
    //
    //     bridgeReceiptAccount = blockchain.openContract(
    //         BridgeReceiptAccount.createFromAddress(receiptAccountAddress));
    //     let receipt = await bridgeReceiptAccount.getReceiptInfo(chainId);
    //     expect(receipt.totalAmount).toBe(toNano('10'));
    //     expect(receipt.index).toBe(BigInt(1));
    // });

    // it('swap native', async () => {
    //     console.log(oracle.address);
    //     console.log(testAccount.address);
    //     console.log(bridge.address);
    //     console.log(bridgeSwapTonCoin.address);
    //     console.log(bridgePoolTonCoin.address);
    //
    //     let account_balance_before = await testAccount.getBalance();
    //
    //     let balanceBefore = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
    //     expect(balanceBefore).toBeGreaterThanOrEqual(toNano('20'));
    //     let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJUC+QAmUXSGzTyJjueaHKaCsorIlPuRZ+MzyhtwrYq4opKej0RAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJM=";
    //     let dataFullBuffer = Buffer.from(dataFull, 'base64');
    //     let messageId = BigInt(11111);
    //     let sourceChainId = 9992731;
    //     let targetChainId = 1101;
    //     let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
    //     let receiver = bridge.address;
    //     let data = dataFullBuffer.slice(0, 96);
    //     let dataOther = dataFullBuffer.slice(96);
    //     let result = await bridge.sendTransmit(
    //         oracle.getSender(),
    //         toNano('0.01'),
    //         messageId,
    //         sourceChainId,
    //         targetChainId,
    //         sender,
    //         receiver,
    //         data,
    //         dataOther,
    //         swapIdTonCoin,
    //         HOLEADDRESS
    //     );
    //     // let tx = result.transactions[3];
    //     // let body = tx.outMessages.get(0)?.body;
    //     // if (body != undefined) {
    //     //     let info = body.asSlice();
    //     //     let value = info.loadCoins();
    //     //     let value1 = info.loadCoins();
    //     //     let value2 = info.loadCoins();
    //     //     console.log(value1);
    //     //     console.log(value);
    //     //     console.log(value2);
    //     // }
    //
    //     expect(result.transactions).toHaveTransaction({
    //         from: oracle.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridge.address,
    //         to: bridgeSwapTonCoin.address,
    //         success: true
    //     });
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridgeSwapTonCoin.address,
    //         to: bridgePoolTonCoin.address,
    //         success: true
    //     });
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridgePoolTonCoin.address,
    //         to: bridgeSwapTonCoin.address,
    //         success: true
    //     });
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridgePoolTonCoin.address,
    //         to: testAccount.address,
    //         success: true
    //     });
    //
    //     const transferTx = findTransactionRequired(result.transactions, {
    //         on: testAccount.address,
    //         from: bridgePoolTonCoin.address,
    //         success: true
    //     });
    //     let transferFee = printTxGasStats("transfer", transferTx);
    //     // gas used:309
    //     transferFee = computeGasFee(gasPrices, 309n);
    //     console.log(transferFee);
    //
    //
    //     let liquidityAfter = await bridgePoolTonCoin.getPoolLiquidity();
    //     expect(liquidityAfter).toBe(BigInt(20000000000 - 100000000));
    //
    //     let balance = (await blockchain.getContract(bridgePoolTonCoin.address)).balance;
    //     expect(balance).toBeGreaterThanOrEqual(toNano('20') - toNano('0.1'));
    //     expect(balance).toBeLessThan(balanceBefore);
    //
    //     let account_balance = await testAccount.getBalance();
    //     let diff = account_balance - account_balance_before;
    //     console.log(diff);
    //     expect(account_balance).toBe(account_balance_before + toNano('0.1'));
    // });
    // it('swap1', async () => {
    //     const userLiquidityAddress = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
    //     const smc = await blockchain.getContract(userLiquidityAddress);
    //     if (smc.accountState === undefined)
    //         throw new Error("Can't access wallet account state");
    //     if (smc.accountState.type !== "active")
    //         throw new Error("Wallet account is not active");
    //     if (smc.account.account === undefined || smc.account.account === null)
    //         throw new Error("Can't access wallet account!");
    //     console.log("bridge liquidity storage stats:", smc.account.account.storageStats.used);
    //     const state = smc.accountState.state;
    //     const stateCell = beginCell().store(storeStateInit(state)).endCell();
    //     console.log("State init stats:", collectCellStats(stateCell, []));
    //
    //     console.log(testAccount.address);
    //     console.log(accountJettonWallet.address);
    //     // EQBIDbk317LrsY3GE3ktW6c_1iSfNmjuKSVw5TfBeYbUqEHD                                                                                        
    //     console.log(bridge.address);
    //     console.log(bridgeSwap.address);
    //     console.log(bridgePool.address);
    //     console.log(bridgePoolJettonWallet.address);
    //     expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
    //     let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJUC+QAmUXSGzTyJjueaHKaCsorIlPuRZ+MzyhtwrYq4opKej0RAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJM=";
    //     let dataFullBuffer = Buffer.from(dataFull, 'base64');
    //     let messageId = BigInt(11111);
    //     let sourceChainId = 9992731;
    //     let targetChainId = 1101;
    //     let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
    //     let receiver = bridge.address;
    //     let data = dataFullBuffer.slice(0, 96);
    //     let dataOther = dataFullBuffer.slice(96);
    //     let result = await bridge.sendTransmit(
    //         oracle.getSender(),
    //         toNano('0.01'),
    //         messageId,
    //         sourceChainId,
    //         targetChainId,
    //         sender,
    //         receiver,
    //         data,
    //         dataOther,
    //         swapId,
    //         jettonMinter.address
    //     );
    //
    //     expect(result.transactions).toHaveTransaction({
    //         from: oracle.address,
    //         to: bridge.address,
    //         success: true,
    //     });
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridge.address,
    //         to: bridgeSwap.address,
    //         success: true
    //     });
    //
    //     // let tx = findTransactionRequired(result.transactions, {                                                                                 
    //     //     to: bridgeSwap.address,                                                                                                             
    //     //     from: bridge.address,                                                                                                               
    //     //     success: true                                                                                                                       
    //     // });                                                                                                                                     
    //     // console.log(tx.outMessages.size)                                                                                                        
    //     // let body2 = tx.outMessages.get(0)?.body;                                                                                                
    //     // if (body2 != undefined) {                                                                                                               
    //     //     let info = body2.asSlice();                                                                                                         
    //     //     let value = info.loadUint(32);                                                                                                      
    //     //     let queryid = info.loadUint(64);                                                                                                    
    //     //     let swap_id_cell = info.loadRef().asSlice().loadBuffer(32).toString('hex')                                                          
    //     //     let message_id = info.loadInt(256)                                                                                                  
    //     //     let receiptInfo =  info.loadRef().asSlice()                                                                                         
    //     //     let receipt_id = receiptInfo.loadRef().asSlice().loadBuffer(32).toString("hex")                                                     
    //     //     //let receipt_id1 = receiptInfo.loadRef().asSlice().loadUintBig(256)                                                                
    //     //     let receipt_hash = receiptInfo.loadBuffer(32).toString('hex')                                                                       
    //     //     let target_address = receiptInfo.loadAddress()                                                                                      
    //     //     let from_chain_id = info.loadUint(32)                                                                                               
    //     //     let swap_amount = info.loadCoins()                                                                                                  
    //     //                                                                                                                                         
    //     //     console.log("********")                                                                                                             
    //     //     console.log(value);                                                                                                                 
    //     //     console.log(queryid);                                                                                                               
    //     //     console.log(swap_id_cell);                                                                                                          
    //     //     console.log(message_id);                                                                                                            
    //     //     console.log(receipt_id);                                                                                                            
    //     //     //console.log(receipt_id1);                                                                                                         
    //     //     console.log(receipt_hash);                                                                                                          
    //     //     console.log(target_address);                                                                                                        
    //     //     console.log(from_chain_id);                                                                                                         
    //     //     console.log(swap_amount);                                                                                                           
    //     //     //console.log(receipt_hash);                                                                                                        
    //     //     console.log("********")                                                                                                             
    //     // }                                                                                                                                       
    //
    //
    //     // let tx = findTransactionRequired(result.transactions, {                                                                                 
    //     //     to: bridge.address,                                                                                                                 
    //     //     from: oracle.address,                                                                                                               
    //     //     success: true                                                                                                                       
    //     // });                                                                                                                                     
    //     // //AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJUC+QAmUXSGz
    //     // console.log("----")                                                                                                                     
    //     // //AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOjUpRAAleKDo/
    //     // //leaf_hash:"9945d21b34f2263b9e68729a0aca2b2253ee459f8ccf286dc2b62ae28a4a7a3d"                                                          
    //     // //receipt_target_address: kQDYnId__pLw2tqEK6TQs30lMYWECEX-bwpNrwfFGpr2dpU8                                                              
    //     // //receipt_count: 1                                                                                                                      
    //     // //key_hash: "53adfb5682c10859e844f4eaff88bb4a5cbba2a446d2e71fd822b997d07a8990"                                                          
    //     // //amount: 10000                                                                                                                         
    //     // let body = tx.outMessages.get(0)?.body                                                                                                  
    //     // let swapInfo = body?.asSlice()                                                                                                          
    //     // let op = swapInfo?.loadUint(32)                                                                                                         
    //     // let query_id = swapInfo?.loadUint(64)                                                                                                   
    //     // let swap_id_ref = swapInfo?.loadRef().asSlice().loadBuffer(32).toString('hex')                                                          
    //     // let messageid = swapInfo?.loadInt(256)                                                                                                  
    //     // let swap_infos = swapInfo?.loadRef().asSlice()                                                                                          
    //     // let swap_info1 = swap_infos?.loadRef().asSlice()                                                                                        
    //     // let keyhash = swap_info1?.loadBuffer(32).toString("hex")                                                                                
    //     // let leaf_hash = swap_infos?.loadBuffer(32).toString("hex")                                                                              
    //     // let receipt_index = swap_info1?.loadUint(256)                                                                                           
    //     // let receipt_target_address = swap_infos?.loadAddress()                                                                                  
    //     // let amount = swapInfo?.loadCoins()                                                                                                      
    //     //                                                                                                                                         
    //     // swapid: 6d1af86d7a907efc93257a1d6f2ba55b184ebd3d1494552b0368b2fd7e39d415                                                                
    //     // keyhash  53adfb5682c10859e844f4eaff88bb4a5cbba2a446d2e71fd822b997d07a8990                                                               
    //     //  leaf_hash      9945d21b34f2263b9e68729a0aca2b2253ee459f8ccf286dc2b62ae28a4a7a3d                                                        
    //     // EQBvA4zKQaQOjwu7HbyHiWJU7xQyzV4hre1YXq2PzVR2UTyT                                                                                        
    //     // console.log(op);                                                                                                                        
    //     // console.log(query_id);                                                                                                                  
    //     // console.log(swap_id_ref);                                                                                                               
    //     // console.log(messageid);                                                                                                                 
    //     // console.log(keyhash);                                                                                                                   
    //     // console.log(leaf_hash);                                                                                                                 
    //     // console.log(receipt_target_address);                                                                                                    
    //     // console.log(receipt_index);                                                                                                             
    //     // console.log(amount);                                                                                                                    
    //     // console.log("----------");                                                                                                              
    //
    //     // for (let i = 0; i < tx.outMessages.size; i++) {                                                                                         
    //     //     // console.log(tx.outMessages.get(i));                                                                                              
    //     //     // console.log(tx.outMessages.get(i)?.info);                                                                                        
    //     //     // console.log(tx.outMessages.get(i)?.info?.dest.value);                                                                            
    //     //     if (tx.outMessages.get(i)?.info?.dest.value != undefined && tx.outMessages.get(i)?.info?.dest.value == Op.bridge.swap) {            
    //     //         let body = tx.outMessages.get(i)?.body;                                                                                         
    //     //         if (body != undefined) {                                                                                                        
    //     //             let lockInfo = body.asSlice();                                                                                              
    //     //             let eventId = lockInfo.loadUint(32);                                                                                        
    //     //             console.log(eventId);                                                                                                       
    //     //                                                                                                                                         
    //     //         }                                                                                                                               
    //     //     }                                                                                                                                   
    //     // }                                                                                                                                       
    //
    //
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridgeSwap.address,
    //         to: bridgePool.address,
    //         success: true
    //     });
    //
    //     let tx3 = findTransactionRequired(result.transactions, {
    //         on: bridgePool.address,
    //         from: bridgeSwap.address,
    //         success: true
    //     });
    //     console.log("___________")
    //     console.log(tx3.outMessages.size)
    //     let body =  tx3.outMessages.get(4)?.body
    //     if (body != undefined) {
    //         let info = body.asSlice();
    //         console.log(info)
    //         let value = info.loadUint(32)
    //         console.log(value);
    //     }
    //     console.log("___________")
    //
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridgePool.address,
    //         to: bridgePoolJettonWallet.address,
    //         success: true
    //     });
    //
    //     expect(result.transactions).toHaveTransaction({
    //         from: bridgePoolJettonWallet.address,
    //         to: accountJettonWallet.address,
    //         success: true
    //     });
    //
    //     const send_transmit_tx = findTransactionRequired(result.transactions, {
    //         on: bridge.address,
    //         from: oracle.address,
    //         op: Op.bridge.transmit,
    //         success: true
    //     });
    //     send_transmit_gas_fee = printTxGasStats("transmit", send_transmit_tx);
    //     // gas used:17650                                                                                                                          
    //     send_transmit_gas_fee = computeGasFee(gasPrices, 17650n);
    //     console.log(send_transmit_gas_fee);
    //
    //     const send_swap_tx = findTransactionRequired(result.transactions, {
    //         on: bridgeSwap.address,
    //         from: bridge.address,
    //         op: Op.bridge_swap.swap,
    //         success: true
    //     });
    //     send_swap_gas_fee = printTxGasStats("swap", send_swap_tx);
    //     // gas used:12558                                                                                                                          
    //     send_swap_gas_fee = computeGasFee(gasPrices, 12558n);
    //     console.log(send_swap_gas_fee);
    //     const swapInMessage = send_swap_tx.inMessage!
    //     let swapMessageStats = computeMessageForwardFees(msgPrices, swapInMessage).stats;
    //     console.log(swapMessageStats);
    //
    //     const send_release_tx = findTransactionRequired(result.transactions, {
    //         on: bridgePool.address,
    //         from: bridgeSwap.address,
    //         op: Op.bridge_pool.release,
    //         success: true
    //     });
    //     send_release_gas_fee = printTxGasStats("release", send_release_tx);
    //     // gas used:34096                                                                                                                          
    //     send_release_gas_fee = computeGasFee(gasPrices, 34096n);
    //     console.log(send_release_gas_fee);
    //     const releaseInMessage = send_release_tx.inMessage!
    //     let releaseMessageStats = computeMessageForwardFees(msgPrices, releaseInMessage).stats;
    //     console.log(releaseMessageStats);
    //
    //     const send_transfer_tx = findTransactionRequired(result.transactions, {
    //         on: bridgePoolJettonWallet.address,
    //         from: bridgePool.address,
    //         op: Op.jetton.transfer,
    //         success: true
    //     });
    //     send_transfer_to_gas_fee = printTxGasStats("transfer", send_transfer_tx);
    //     // gas used:8341                                                                                                                           
    //     send_transfer_to_gas_fee = computeGasFee(gasPrices, 8341n);
    //     console.log(send_transfer_to_gas_fee);
    //     const transferInMessage = send_transfer_tx.inMessage!
    //     let transferMessageStats = computeMessageForwardFees(msgPrices, transferInMessage).stats;
    //     console.log(transferMessageStats);
    //
    //     const receive_tx = findTransactionRequired(result.transactions, {
    //         on: accountJettonWallet.address,
    //         from: bridgePoolJettonWallet.address,
    //         op: Op.jetton.internal_transfer,
    //         success: true
    //     });
    //     send_receive_gas_fee = printTxGasStats("receive", receive_tx);
    //     // gas used:7822                                                                                                                           
    //     send_receive_gas_fee = computeGasFee(gasPrices, 7822n);
    //     console.log(send_receive_gas_fee);
    //     const receiveInMessage = receive_tx.inMessage!
    //     let receiveMessageStats = computeMessageForwardFees(msgPrices, receiveInMessage).stats;
    //     console.log(receiveMessageStats);
    //
    //     const send_record_swap_tx = findTransactionRequired(result.transactions, {
    //         on: bridgeSwap.address,
    //         from: bridgePool.address,
    //         op: Op.bridge_pool.record_swap,
    //         success: true
    //     });
    //     send_record_swap_gas_fee = printTxGasStats("record swap", send_record_swap_tx);
    //     // gas used:9706                                                                                                                           
    //     send_record_swap_gas_fee = computeGasFee(gasPrices, 9706n);
    //     console.log(send_record_swap_gas_fee);
    //     const recordSwapInMessage = send_record_swap_tx.inMessage!
    //     let recordSwapMessageStats = computeMessageForwardFees(msgPrices, recordSwapInMessage).stats;
    //     console.log(recordSwapMessageStats);
    //     const send_swap_ok_tx = findTransactionRequired(result.transactions, {
    //         on: bridge.address,
    //         from: bridgeSwap.address,
    //         op: Op.bridge.swap_ok,
    //         success: true
    //     });
    //     send_swap_ok_gas_fee = printTxGasStats("swap ok", send_swap_ok_tx);
    //     // gas used:6592                                                                                                                           
    //     send_swap_ok_gas_fee = computeGasFee(gasPrices, 6482n);
    //     console.log(send_swap_ok_gas_fee);
    //     const swapOkInMessage = send_swap_ok_tx.inMessage!
    //     let swapOkMessageStats = computeMessageForwardFees(msgPrices, swapOkInMessage).stats;
    //     console.log(swapOkMessageStats);
    //     expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 10000000));
    //     let liquidityAfter = await bridgePool.getPoolLiquidity();
    //     expect(liquidityAfter).toBe(BigInt(100000000000 - 10000000));
    //     expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(100000000000 - 10000000));
    //
    // });
});

function getUTCMidnight(): number {
    const now = new Date();
    // Create a new Date object for today's midnight in UTC
    let time = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    console.log(time);
    return time / 1000;
}
