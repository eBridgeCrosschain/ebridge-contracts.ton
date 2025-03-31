import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, toNano} from '@ton/core';
import {BridgePool} from '../wrappers/BridgePool';
import '@ton/test-utils';
import {compile} from '@ton/blueprint';
import {findTransactionRequired, randomAddress} from "@ton/test-utils";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {Buffer} from "buffer";
import {BridgePoolLiquidityAccount} from "../wrappers/BridgePoolLiquidityAccount";
import aelf from "aelf-sdk";
import exp from "constants";
import {Op} from "../wrappers/constants";


describe('BridgePool', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bridgePool: SandboxContract<BridgePool>;
    let jwallet_code: Cell;
    let minter_code: Cell;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWallet: SandboxContract<JettonWallet>;
    let userWallet: any;
    let defaultContent: Cell;
    let testAccount: SandboxContract<TreasuryContract>
    let accountJettonWallet: any;
    let bridgePoolJettonWallet: any;
    let testJettonAddress: Address;
    let testJettonAddress1: Address;
    let bridge: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let tempUpgrade: Cell;
    let bridgeLiquidityAccountCode: Cell;
    let initialState: BlockchainSnapshot;
    let curTime: number;
    const chainId = 9992731;
    let bridgePoolTonCoin: SandboxContract<BridgePool>;
    let HOLEADDRESS: Address;


    beforeAll(async () => {
        code = await compile('BridgePool');
        bridgeLiquidityAccountCode = await compile('BridgePoolLiquidityAccount');
        jwallet_code = await compile('JettonWallet');
        minter_code = await compile('JettonMinter');

        blockchain = await Blockchain.create();

        curTime = blockchain.now ?? Math.floor(Date.now() / 1000);

        testJettonAddress1 = randomAddress();
        testJettonAddress = randomAddress();

        bridge = await blockchain.treasury('Bridge');
        admin = await blockchain.treasury('admin');
        owner = await blockchain.treasury('owner');
        HOLEADDRESS = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");

        tempUpgrade = beginCell().endCell();
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

        let dic = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        let receipt_dic = Dictionary.empty(Dictionary.Keys.Uint(8), Dictionary.Values.Cell());
        let receiptRecordDic = Dictionary.empty(Dictionary.Keys.BigUint(320), Dictionary.Values.Cell());
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
        }, code));

        const deployResult = await bridgePool.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridgePool.address,
            deploy: true,
            success: true,
        });

        const deployerJettonWallet = await userWallet(deployer.address);
        accountJettonWallet = await userWallet(testAccount.address);
        const bridgeJettonWallet = await userWallet(bridge.address);
        bridgePoolJettonWallet = await userWallet(bridgePool.address);

        // first mint some jettons to test account
        let initialAccountJettonBalance = toNano('1000.23');
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

        const bridge1 = await bridgePool.getBridgeAddress();
        expect(bridge1).toEqualAddress(bridge.address);

        let res1 = await bridgePool.sendSetJetton(
            admin.getSender(), toNano('0.5'), bridgePoolJettonWallet.address);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });

        let refreshTime = getUTCMidnight();
        let result = await bridgePool.sendSetDailyLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                refreshTime: refreshTime,
                dailyLimit: 100000000000000000n
            }]
        );
        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });

        let result1 = await bridgePool.sendSetRateLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                tokenCapacity: 1000000000000000n,
                rate: 1000000000n,
            }]);
        expect(result1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });

        let result2 = await bridgePool.sendSetDailyLimit(admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 1,
                refreshTime: refreshTime,
                dailyLimit: 100000000000000000n
            }]);
        expect(result2.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });

        let result3 = await bridgePool.sendSetRateLimit(
            admin.getSender(), toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 1,
                tokenCapacity: 1000000000000000n,
                rate: 1000000000n,
            }]);
        expect(result3.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
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
        }, code));
        const deployPoolTonCoinResult = await bridgePoolTonCoin.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deployPoolTonCoinResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridgePoolTonCoin.address,
            deploy: true,
            success: true,
        });

        initialState = blockchain.snapshot();

    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('should add liquidity successfully', async () => {
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('0.1');
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

    });
    it('add liquidity failed, not enough fee, return jetton to user', async () => {
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('0.098');
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
            success: true
        });
        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });

        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('1000.23'));
    });
    it('add liquidity failed, invalid sender, return jetton to user', async () => {
        let res = await bridgePool.sendSetJetton(
            admin.getSender(), toNano('0.5'), admin.address);
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('0.1');
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
            success: true
        });
        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: bridgePoolJettonWallet.address,
            to: accountJettonWallet.address,
            success: true
        });

        let balance = await accountJettonWallet.getJettonBalance();
        expect(balance).toEqual(toNano('1000.23'));
    });
    it('add native liquidity successfully', async () => {
        let testAccountBalanceBefore = await testAccount.getBalance();
        let resAddLiquidity = await bridgePoolTonCoin.sendAddNativeLiquidity(testAccount.getSender(), toNano('21'), toNano('20'));
        expect(resAddLiquidity.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePoolTonCoin.address,
            success: true,
        });
        let liquidityAfter = await bridgePoolTonCoin.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(20000000000));
        let testAccountBalance = await testAccount.getBalance();
        let dif = testAccountBalanceBefore - testAccountBalance;
        expect(dif).toBeGreaterThan(toNano(20));
    });
    it('add native liquidity failed, not enough fee', async () => {
        let fee = await bridgePoolTonCoin.getAddNativeLiquidityFee();
        console.log(fee);
        let testAccountBalanceBefore = await testAccount.getBalance();
        let resAddLiquidity = await bridgePoolTonCoin.sendAddNativeLiquidity(testAccount.getSender(), toNano('20.058'), toNano('20'));
        expect(resAddLiquidity.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePoolTonCoin.address,
            success: false,
            exitCode: 101
        });
        let testAccountBalance = await testAccount.getBalance();
        let dif = testAccountBalanceBefore - testAccountBalance;
        expect(dif).toBeLessThan(fee);
    });
    it('add native liquidity failed, unSupport token op', async () => {
        let fee = await bridgePoolTonCoin.getAddNativeLiquidityFee();
        console.log(fee);
        let testAccountBalanceBefore = await testAccount.getBalance();
        let resAddLiquidity = await bridgePool.sendAddNativeLiquidity(testAccount.getSender(), toNano('21'), toNano('20'));
        expect(resAddLiquidity.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 102
        });
        let testAccountBalance = await testAccount.getBalance();
        let dif = testAccountBalanceBefore - testAccountBalance;
        expect(dif).toBeLessThan(fee);
    });
    it('remove liquidity successfully', async () => {
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('0.1');
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
        let liquidityAfter1 = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter1).toBe(BigInt(0));
        let testAccountBalance = await accountJettonWallet.getJettonBalance();
        expect(testAccountBalance).toEqual(toNano('1000.23'));
    });
    it('remove liquidity failed, unauthorized', async () => {
        let res = await bridgePool.sendRemoveLiquidity(testAccount.getSender(), toNano('0.1'), toNano('100'),testAccount.address);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 81
        });
    });
    it('remove liquidity failed, liquidity not enough', async () => {
        let amount_add_liquidity = toNano('100');
        let forwardAmount = toNano('0.1');
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
            toNano('101'),
            true
        );
        expect(remove_result.transactions).toHaveTransaction({
            from: testAccount.address,
            to: userLiquidityAddress,
            success: false,
            exitCode: 93
        });
    });
    it('set daily limit successfully', async () => {
        let refreshTime = getUTCMidnight();
        let res = await bridgePool.sendSetDailyLimit(
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
        expect(res.transactions).toHaveTransaction({
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
    });
    it('set daily limit failed, unauthorized', async () => {
        let refreshTime = getUTCMidnight();
        let res = await bridgePool.sendSetDailyLimit(
            testAccount.getSender(),
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
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 81
        });
    });
    it('set daily limit failed, invalid refresh time', async () => {
        let refreshTime = getUTCMidnight();
        let res = await bridgePool.sendSetDailyLimit(
            admin.getSender(),
            toNano('0.5'),
            [{
                chainId: chainId,
                limitType: 0,
                refreshTime: refreshTime - 1000,
                dailyLimit: 100000000000000000n
            },
                {
                    chainId: chainId,
                    limitType: 1,
                    refreshTime: refreshTime,
                    dailyLimit: 100000000000000000n
                }]);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: false,
            exitCode: 86
        });
    });
    it('set daily limit failed, not support refresh time', async () => {
        const now = new Date();
        // Create a new Date object for today's midnight in UTC
        let time = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
        console.log(time);
        let refreshTime = time / 1000;
        let res = await bridgePool.sendSetDailyLimit(
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
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: false,
            exitCode: 87
        });
    });
    it('set rate limit successfully', async () => {
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
    });
    it('set rate limit failed, unauthorized', async () => {
        let res7 = await bridgePool.sendSetRateLimit(
            testAccount.getSender(),
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
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 81
        });
    });
    it('create swap successfully', async () => {
        const result = await bridgePool.sendCreateSwap(
            admin.getSender(), toNano('0.5'), [{
                fromChainId: chainId,
                originShare: 1,
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
            expect(fromChainId).toBe(chainId);
        }
    });
    it('create swap failed, unauthorized', async () => {
        const result = await bridgePool.sendCreateSwap(
            testAccount.getSender(), toNano('0.5'), [{
                fromChainId: chainId,
                originShare: 1,
                targetShare: 1
            }]);

        expect(result.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 81
        });
    });
    it('set bridge successfully', async () => {
        let res = await bridgePool.sendSetBridge(
            admin.getSender(), toNano('0.5'), testJettonAddress);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        const bridge1 = await bridgePool.getBridgeAddress();
        expect(bridge1).toEqualAddress(testJettonAddress);
    });
    it('set bridge failed, unauthorized', async () => {
        let res = await bridgePool.sendSetBridge(
            testAccount.getSender(), toNano('0.5'), testJettonAddress);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 81
        });
    });
    it('set jetton wallet address successfully', async () => {
        let res = await bridgePool.sendSetJetton(
            admin.getSender(), toNano('0.5'), bridgePoolJettonWallet.address);
        expect(res.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
    });
    it('set jetton wallet address failed, unauthorized', async () => {
        let res = await bridgePool.sendSetJetton(
            testAccount.getSender(), toNano('0.5'), bridgePoolJettonWallet.address);
        expect(res.transactions).toHaveTransaction({
            from: testAccount.address,
            to: bridgePool.address,
            success: false,
            exitCode: 81
        });
    });
});

function getUTCMidnight(): number {
    const now = new Date();
    // Create a new Date object for today's midnight in UTC
    let time = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    console.log(time);
    return time / 1000;
}
