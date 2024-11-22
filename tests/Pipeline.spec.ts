import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Address, beginCell, BitString, Cell, Dictionary, toNano} from '@ton/core';
import {Bridge} from '../wrappers/Bridge';
import {BridgePool} from '../wrappers/BridgePool';
import {BridgeSwap} from '../wrappers/BridgeSwap';
import '@ton/test-utils';
import {compile} from '@ton/blueprint';
import {Buffer} from "buffer";
import {JettonMinter} from "../wrappers/JettonMinter";
import {JettonWallet} from "../wrappers/JettonWallet";
import {BridgeReceiptAccount} from "../wrappers/BridgeReceiptAccount";
import {BridgePoolLiquidityAccount} from "../wrappers/BridgePoolLiquidityAccount";
import aelf from "aelf-sdk";

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
    let bridgeSwap_code: Cell;
    let bridgePool_code: Cell;
    let bridgeReceiptAccountCode: Cell;
    let bridgeLiquidityAccountCode: Cell;
    // contract
    let bridge: SandboxContract<Bridge>;
    let bridgeSwap: SandboxContract<BridgeSwap>;
    let bridgePool: SandboxContract<BridgePool>;
    let bridgeReceiptAccount: SandboxContract<BridgeReceiptAccount>;
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

    // upgrade
    let tempUpgrade: Cell;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        tempUpgrade = beginCell().endCell();
        deployer = await blockchain.treasury('deployer');
        admin = await blockchain.treasury('admin');
        owner = await blockchain.treasury('owner');
        testAccount = await blockchain.treasury('testAccount');

        bridge_code = await compile('Bridge');
        bridgeSwap_code = await compile('BridgeSwap');
        bridgePool_code = await compile('BridgePool');
        bridgeReceiptAccountCode = await compile('BridgeReceiptAccount');
        bridgeLiquidityAccountCode = await compile('BridgePoolLiquidityAccount');
        jwallet_code = await compile('JettonWallet');
        minter_code = await compile('JettonMinter');

        // jetton
        // 1. deploy mock jetton contract
        // 2. deploy mock jetton wallet
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
        // 3. deploy bridge contract
        oracle = await blockchain.treasury('oracle');
        pauseController = await blockchain.treasury('pauseController');
        let poolContractDicDefault = Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.Address());
        let swapContractDicDefault = Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.Address());
        let jettonWhitelistDicDefault = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        let targetContractDicDefault = Dictionary.empty();
        bridge = blockchain.openContract(Bridge.createFromConfig({
            bridge_swap_address_dic: swapContractDicDefault,
            bridge_pool_address_dic: poolContractDicDefault,
            oracle_address: oracle.address,
            jetton_whitelist_dic: jettonWhitelistDicDefault,
            is_pause: false,
            pause_controller: pauseController.address,
            admin: admin.address,
            owner: owner.address,
            temp_upgrade: tempUpgrade,
            bridge_receipt_account_code: bridgeReceiptAccountCode,
            target_contract_dic: targetContractDicDefault
        }, bridge_code));
        const deployBridgeResult = await bridge.sendDeploy(deployer.getSender(), toNano('0.1'));
        expect(deployBridgeResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridge.address,
            deploy: true,
            success: true,
        });
        // 4. deploy bridge pool contract
        let dic = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        bridgePool = blockchain.openContract(BridgePool.createFromConfig({
            bridge_address: bridge.address,
            bridge_receipt_account_code: bridgeReceiptAccountCode,
            bridge_swap_address: null,
            jetton_address: jettonMinter.address,
            daily_limit: dic,
            rate_limit: dic,
            pool_liquidity_account_code: bridgeLiquidityAccountCode,
            admin: admin.address,
            owner: owner.address,
            temp_upgrade: tempUpgrade
        }, bridgePool_code));
        const deployPoolResult = await bridgePool.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deployPoolResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridgePool.address,
            deploy: true,
            success: true,
        });

        // 5. deploy bridge swap contract
        bridgeSwap = blockchain.openContract(BridgeSwap.createFromConfig({
            bridgePoolAddress: bridgePool.address,
            jettonAddress: jettonMinter.address,
            bridgeAddress: bridge.address,
            oracleAddress: oracle.address,
            admin: admin.address,
            owner: owner.address,
            tempUpgrade: tempUpgrade,
            swapDic: dic,
            receiptDic: dic
        }, bridgeSwap_code));
        const deploySwapResult = await bridgeSwap.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(deploySwapResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bridgeSwap.address,
            deploy: true,
            success: true,
        });


        // 6. open bridge receipt account - test account
        const bridgeReceiptAddress = await bridgePool.getReceiptAddress(testAccount.address);
        bridgeReceiptAccount = blockchain.openContract(
            BridgeReceiptAccount.createFromAddress(bridgeReceiptAddress));

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

        // bridge 
        // 1. add jetton whitelist
        const res1 = await bridge.sendAddJetton(
            admin.getSender(),
            toNano('0.5'), [jettonMinter.address], chainId);
        expect(res1.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        // 2. set bridge swap
        const res2 = await bridge.sendSetBridgeSwap(admin.getSender(), toNano('0.5'), [{
            jetton_address: jettonMinter.address,
            contract_address: bridgeSwap.address
        }]);
        expect(res2.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        let get_res = await bridge.getBridgeSwap(jettonMinter.address);
        expect(get_res).toEqualAddress(bridgeSwap.address);
        // 3. set bridge pool
        const res3 = await bridge.sendSetBridgePool(
            admin.getSender(), toNano('0.5'),
            [{
                jetton_address: jettonMinter.address,
                contract_address: bridgePool.address
            }]);
        expect(res3.transactions).toHaveTransaction({
            from: admin.address,
            to: bridge.address,
            success: true,
        });
        expect(await bridge.getBridgePool(jettonMinter.address)).toEqualAddress(bridgePool.address);

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
        // 1, create swap
        const result = await bridgeSwap.sendCreateSwap(
            admin.getSender(), toNano('0.5'), [{
                fromChainId: chainId,
                originShare: 1000,
                targetShare: 1
            }]);

        expect(result.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgeSwap.address,
            success: true,
        });
        let body = result.transactions[1].outMessages.get(0)?.body;
        if (body != undefined) {
            let info = body.asSlice();
            let swapInfo = info.loadRef().asSlice();
            let fromChainId = swapInfo.loadUint(32);
            let swapId_log = swapInfo.loadRef();
            console.log(fromChainId);
            console.log(swapId_log.asSlice().loadBuffer(32).toString('hex'));
            swapId = swapId_log;
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
        // 1.' set bridge swap address
        let r = await bridgePool.sendSetBridgeSwap(
            admin.getSender(), toNano('0.5'), bridgeSwap.address);
        expect(r.transactions).toHaveTransaction({
            from: admin.address,
            to: bridgePool.address,
            success: true,
        });
        // 2. set jetton 
        let res5 = await bridgePool.sendSetJetton(
            admin.getSender(), toNano('0.5'), jettonMinter.address, bridgePoolJettonWallet.address);
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
        let forwardAmount = toNano('0.05');
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
        const liquidity_account = await bridgePool.getPoolLiquidityAccountAddress(testAccount.address);
        expect(add_liquidity_res.transactions).toHaveTransaction({
            from: bridgePool.address,
            to: liquidity_account,
            deploy: true,
            success: true,
        });

        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000));

        initialState = blockchain.snapshot();
        curTime = () => blockchain.now ?? Math.floor(Date.now() / 1000);
    });

    afterEach(async () => await blockchain.loadFrom(initialState));


    it('should deploy and init', async () => {
        // the check is done inside beforeEach
        // blockchain and ebridgeContractsTon are ready to use
    });
    it('create receipt', async () => {
            console.log(testAccount.address);
            console.log(accountJettonWallet.address);
            console.log(bridge.address);
            console.log(bridgeJettonWallet.address);
            console.log(bridgePool.address);
            console.log(bridgePoolJettonWallet.address);

            let targetAddress = "JKjoabe2wyrdP1P8TvNyD4GZP6z1PuMvU2y5yJ4JTeBjTMAoX";
            const targetAddressBuffer = aelf.utils.base58.decode(targetAddress);

            let receipt_amount = toNano('10');
            let forwardAmount = toNano('1');
            let payload = Bridge.PackCreateReceiptBody(
                chainId, accountJettonWallet.address,
                Buffer.from(targetAddressBuffer), jettonMinter.address);

            const result = await accountJettonWallet.sendTransfer(
                testAccount.getSender(),
                toNano('3'),
                receipt_amount,
                bridge.address,
                testAccount.address,
                beginCell().storeUint(0, 1).endCell(),
                forwardAmount,
                payload);

            let body = result.transactions[4].outMessages.get(0)?.body;
            if (body != undefined) {
                let info = body.asSlice();
                console.log(info);
            }
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
                from: bridge.address,
                to: oracle.address,
                success: true,
            });

            let balance = await accountJettonWallet.getJettonBalance();
            expect(balance).toEqual(toNano('890.23'));
            let balance1 = await bridgePoolJettonWallet.getJettonBalance();
            expect(balance1).toEqual(toNano('110'));
            let balance2 = await bridgeJettonWallet.getJettonBalance();
            expect(balance2).toEqual(0n);

            let liquidityAfter = await bridgePool.getPoolLiquidity();
            expect(liquidityAfter).toBe(BigInt(100000000000 + 10000000000));

            const res3 = await bridgePool.getReceiptDailyLimit(chainId);
            expect(res3.remainToken).toBe(BigInt(100000000000000000 - 10000000000));
            console.log(res3.refreshTime);
            expect(res3.dailyLimit).toBe(BigInt(100000000000000000));

            const res4 = await bridgePool.getReceiptRateLimit(chainId);
            expect(res4.currentTokenAmount).toBe(BigInt(1000000000000000 - 10000000000));
            expect(res4.tokenCapacity).toBe(BigInt(1000000000000000));
            expect(res4.rate).toBe(BigInt(1000000000));
            expect(res4.isEnable).toBe(true);

            const bridgeReceiptAddress = await bridgePool.getReceiptAddress(testAccount.address);
            bridgeReceiptAccount = blockchain.openContract(
                BridgeReceiptAccount.createFromAddress(bridgeReceiptAddress));

            let receipt = await bridgeReceiptAccount.getReceiptInfo(chainId);
            expect(receipt.totalAmount).toBe(toNano('10'));
            expect(receipt.index).toBe(BigInt(1));

            console.log(bridgeReceiptAddress);
            console.log(oracle.address);
            let transactionCount = result.transactions.length;
            console.log(transactionCount);
            for (let i = 1; i < transactionCount; i++) {
                console.log(result.transactions[i].inMessage.info.src);
                console.log(result.transactions[i].inMessage.info.dest);
                if (result.transactions[i].inMessage.info.dest.toString() == oracle.address) {
                    let inMessage = result.transactions[i].inMessage;
                    let body = inMessage.body;
                    if (body != undefined) {
                        let info = body.asSlice();
                        let op = info.loadUint(32);
                        console.log(op);
                        let chain_id = info.loadUint(64);
                        console.log(chain_id);
                        let target = info.loadRef();
                        console.log(target);
                        // message 
                        let message = info.loadRef();
                        console.log(message);
                        let messageSlice = message.asSlice();
                        console.log(messageSlice);
                        let bitlength = messageSlice.remainingBits;
                        console.log(bitlength);
                        // let index = messageSlice.loadBuffer(32);
                        // console.log(index);
                        // let keyHash = messageSlice.loadBuffer(32);
                        // let jettonAmount = messageSlice.loadBuffer(32);
                        // console.log(jettonAmount)
                        // console.log(Buffer.from(jettonAmount).toString('base64'));
                        let buf = messageSlice.loadBuffer(96);
                        console.log(Buffer.from(buf).toString('base64'));
                        //
                        //             let refs = messageSlice.remainingRefs;
                        //             console.log(refs);
                        //
                        //             let res = Buffer.from(buf);
                        //             for (let j = 0; j < refs; j++) {
                        //                 let cell1 = messageSlice.loadRef();
                        //                 let cellBuf = cell1.asSlice().loadBuffer(32);
                        //                 let buffer2 = Buffer.from(cellBuf);
                        //                 res = Buffer.concat([res, buffer2]);
                        //             }
                        //             console.log(Buffer.from(res).toString('base64'));
                        //         }
                        //     }
                    }
                }
            }
        }
    );
    it('swap', async () => {
        console.log(testAccount.address);
        console.log(accountJettonWallet.address);
        console.log(bridge.address);
        console.log(bridgeSwap.address);
        console.log(bridgePool.address);
        console.log(bridgePoolJettonWallet.address);
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000));
        let dataFull = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFTrftWgsEIWehE9Or/iLtKXLuipEbS5x/YIrmX0HqJkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJUC+QAmUXSGzTyJjueaHKaCsorIlPuRZ+MzyhtwrYq4opKej0RAG8DjMpBpA6PC7sdvIeJYlTvFDLNXiGt7VherY/NVHZRPJM=";
        let dataFullBuffer = Buffer.from(dataFull, 'base64');
        let messageId = BigInt(11111);
        let sourceChainId = 9992731;
        let targetChainId = 1101;
        let sender = aelf.utils.base58.decode("foDLAM2Up3xLjg43SvCy5Ed6zaY5CKG8uczj6yUVZUweqQUmz");
        let receiver = bridge.address;
        let data = dataFullBuffer.slice(0, 96);
        let dataOther = dataFullBuffer.slice(96);
        let result = await bridge.sendTransmit(
            oracle.getSender(),
            toNano('0.5'),
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
            to: bridgeSwap.address,
            success: true
        });
        expect(result.transactions).toHaveTransaction({
            from: bridgeSwap.address,
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
        expect(await accountJettonWallet.getJettonBalance()).toEqual(BigInt(900230000000 + 10000000));
        let liquidityAfter = await bridgePool.getPoolLiquidity();
        expect(liquidityAfter).toBe(BigInt(100000000000 - 10000000));
        expect(await bridgePoolJettonWallet.getJettonBalance()).toEqual(BigInt(100000000000 - 10000000));
        
    });

});

function getUTCMidnight(): number {
    const now = new Date();
    // Create a new Date object for today's midnight in UTC
    let time = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    console.log(time);
    return time / 1000;
}
